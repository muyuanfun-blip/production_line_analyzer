import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import {
  getAllProductionLines, getProductionLineById, createProductionLine,
  updateProductionLine, deleteProductionLine,
  getWorkstationsByLine, getWorkstationById, createWorkstation,
  updateWorkstation, deleteWorkstation, bulkCreateWorkstations,
  getActionStepsByWorkstation, createActionStep, updateActionStep,
  deleteActionStep, bulkCreateActionSteps,
  getSnapshotsByLine, getSnapshotById, createSnapshot, deleteSnapshot, updateSnapshotData,
  getAllLinesLatestSnapshot,
  getAllLinesSnapshotHistory,
  getHandActionsByStep, getHandActionsByStepIds,
  upsertHandAction, deleteHandAction, deleteHandActionsByStep,
  getUserByUsername, getAllUsers, createLocalUser,
  updateUserPassword, toggleUserActive, updateUserRole, updateUserLastSignedIn,
  listSimulations, getSimulationById, createSimulation, updateSimulation, deleteSimulation,
  updateScenarioBackground,
  getProductModelsByLine, getProductModelById, createProductModel,
  updateProductModel, deleteProductModel,
  listProductInstances, getProductInstanceById, createProductInstance,
  updateProductInstance, deleteProductInstance,
  listFlowRecordsByInstance, createFlowRecord, updateFlowRecord,
  deleteFlowRecord, upsertFlowRecords,
} from "./db";
import bcrypt from "bcryptjs";
import { sdk } from "./_core/sdk";
import { ENV } from "./_core/env";

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const productionLineInput = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  targetCycleTime: z.number().positive().optional(),
  status: z.enum(["active", "inactive", "archived"]).optional(),
});

const workstationInput = z.object({
  productionLineId: z.number().int().positive(),
  name: z.string().min(1),
  sequenceOrder: z.number().int().min(0).optional(),
  cycleTime: z.number().positive(),
  manpower: z.number().min(0.5).optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
});

const actionStepInput = z.object({
  workstationId: z.number().int().positive(),
  stepName: z.string().min(1),
  stepOrder: z.number().int().min(0).optional(),
  duration: z.number().positive(),
  actionType: z.enum(["value_added", "non_value_added", "necessary_waste"]).optional(),
  description: z.string().optional(),
});

// ─── Router ──────────────────────────────────────────────────────────────────

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
    localLogin: publicProcedure
      .input(z.object({
        username: z.string().min(1),
        password: z.string().min(1),
      }))
      .mutation(async ({ input, ctx }) => {
        const user = await getUserByUsername(input.username);
        if (!user || !user.passwordHash) {
          throw new Error('帳號或密碼錯誤');
        }
        if (!user.isActive) {
          throw new Error('帳號已停用，請聯絡管理員');
        }
        const valid = await bcrypt.compare(input.password, user.passwordHash);
        if (!valid) {
          throw new Error('帳號或密碼錯誤');
        }
        await updateUserLastSignedIn(user.id);
        const token = await sdk.signSession(
          { openId: user.openId, appId: ENV.appId, name: user.name ?? user.username ?? '' },
          { expiresInMs: 1000 * 60 * 60 * 24 * 30 } // 30 days
        );
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: 1000 * 60 * 60 * 24 * 30 });
        return { success: true, role: user.role, name: user.name ?? user.username };
      }),
  }),

  // ─── Admin: 帳號管理 ─────────────────────────────────────────────────────────
  admin: router({
    listUsers: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== 'admin') throw new Error('無管理員權限');
      return getAllUsers();
    }),

    createUser: protectedProcedure
      .input(z.object({
        username: z.string().min(2).max(64),
        password: z.string().min(6),
        name: z.string().min(1),
        role: z.enum(['user', 'admin']).default('user'),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new Error('無管理員權限');
        const existing = await getUserByUsername(input.username);
        if (existing) throw new Error('帳號名稱已存在');
        const passwordHash = await bcrypt.hash(input.password, 12);
        const user = await createLocalUser({
          username: input.username,
          passwordHash,
          name: input.name,
          role: input.role,
        });
        return { success: true, userId: user?.id };
      }),

    resetPassword: protectedProcedure
      .input(z.object({
        userId: z.number().int().positive(),
        newPassword: z.string().min(6),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new Error('無管理員權限');
        const passwordHash = await bcrypt.hash(input.newPassword, 12);
        await updateUserPassword(input.userId, passwordHash);
        return { success: true };
      }),

    toggleActive: protectedProcedure
      .input(z.object({
        userId: z.number().int().positive(),
        isActive: z.boolean(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new Error('無管理員權限');
        if (input.userId === ctx.user.id) throw new Error('不能停用自己的帳號');
        await toggleUserActive(input.userId, input.isActive ? 1 : 0);
        return { success: true };
      }),

    updateRole: protectedProcedure
      .input(z.object({
        userId: z.number().int().positive(),
        role: z.enum(['user', 'admin']),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new Error('無管理員權限');
        if (input.userId === ctx.user.id) throw new Error('不能修改自己的角色');
        await updateUserRole(input.userId, input.role);
        return { success: true };
      }),
  }),

  // ─── Production Lines ───────────────────────────────────────────────────
  productionLine: router({
    list: publicProcedure.query(async () => {
      return getAllProductionLines();
    }),

    getById: publicProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ input }) => {
        return getProductionLineById(input.id);
      }),

    create: publicProcedure
      .input(productionLineInput)
      .mutation(async ({ input }) => {
        const result = await createProductionLine({
          name: input.name,
          description: input.description ?? null,
          targetCycleTime: input.targetCycleTime?.toString() ?? null,
          status: input.status ?? "active",
        });
        return { success: true, insertId: (result as any).insertId };
      }),

    update: publicProcedure
      .input(z.object({ id: z.number().int().positive() }).merge(productionLineInput.partial()))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        const updateData: Record<string, unknown> = {};
        if (data.name !== undefined) updateData.name = data.name;
        if (data.description !== undefined) updateData.description = data.description;
        if (data.targetCycleTime !== undefined) updateData.targetCycleTime = data.targetCycleTime.toString();
        if (data.status !== undefined) updateData.status = data.status;
        await updateProductionLine(id, updateData as any);
        return { success: true };
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        await deleteProductionLine(input.id);
        return { success: true };
      }),
  }),

  // ─── Workstations ────────────────────────────────────────────────────────
  workstation: router({
    listByLine: publicProcedure
      .input(z.object({ productionLineId: z.number().int().positive() }))
      .query(async ({ input }) => {
        return getWorkstationsByLine(input.productionLineId);
      }),

    getById: publicProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ input }) => {
        return getWorkstationById(input.id);
      }),

    create: publicProcedure
      .input(workstationInput)
      .mutation(async ({ input }) => {
        const result = await createWorkstation({
          productionLineId: input.productionLineId,
          name: input.name,
          sequenceOrder: input.sequenceOrder ?? 0,
          cycleTime: input.cycleTime.toString(),
          manpower: String(input.manpower ?? 1),
          description: input.description ?? null,
          notes: input.notes ?? null,
        });
        return { success: true, insertId: (result as any).insertId };
      }),

    update: publicProcedure
      .input(z.object({ id: z.number().int().positive() }).merge(workstationInput.omit({ productionLineId: true }).partial()))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        const updateData: Record<string, unknown> = {};
        if (data.name !== undefined) updateData.name = data.name;
        if (data.sequenceOrder !== undefined) updateData.sequenceOrder = data.sequenceOrder;
        if (data.cycleTime !== undefined) updateData.cycleTime = data.cycleTime.toString();
        if (data.manpower !== undefined) updateData.manpower = data.manpower;
        if (data.description !== undefined) updateData.description = data.description;
        if (data.notes !== undefined) updateData.notes = data.notes;
        await updateWorkstation(id, updateData as any);
        return { success: true };
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        await deleteWorkstation(input.id);
        return { success: true };
      }),

    bulkImport: publicProcedure
      .input(z.object({
        productionLineId: z.number().int().positive(),
        workstations: z.array(z.object({
          name: z.string().min(1),
          sequenceOrder: z.number().int().min(0),
          cycleTime: z.number().positive(),
          manpower: z.number().min(0.5).optional(),
          description: z.string().optional(),
        })),
      }))
      .mutation(async ({ input }) => {
        const data = input.workstations.map(w => ({
          productionLineId: input.productionLineId,
          name: w.name,
          sequenceOrder: w.sequenceOrder,
          cycleTime: w.cycleTime.toString(),
          manpower: String(w.manpower ?? 1),
          description: w.description ?? null,
          notes: null,
        }));
        await bulkCreateWorkstations(data);
        return { success: true, count: data.length };
      }),
  }),

  // ─── Action Steps ────────────────────────────────────────────────────────
  actionStep: router({
    listByWorkstation: publicProcedure
      .input(z.object({ workstationId: z.number().int().positive() }))
      .query(async ({ input }) => {
        return getActionStepsByWorkstation(input.workstationId);
      }),

    create: publicProcedure
      .input(actionStepInput)
      .mutation(async ({ input }) => {
        const result = await createActionStep({
          workstationId: input.workstationId,
          stepName: input.stepName,
          stepOrder: input.stepOrder ?? 0,
          duration: input.duration.toString(),
          actionType: input.actionType ?? "value_added",
          description: input.description ?? null,
        });
        return { success: true, insertId: (result as any).insertId };
      }),

    update: publicProcedure
      .input(z.object({ id: z.number().int().positive() }).merge(actionStepInput.omit({ workstationId: true }).partial()))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        const updateData: Record<string, unknown> = {};
        if (data.stepName !== undefined) updateData.stepName = data.stepName;
        if (data.stepOrder !== undefined) updateData.stepOrder = data.stepOrder;
        if (data.duration !== undefined) updateData.duration = data.duration.toString();
        if (data.actionType !== undefined) updateData.actionType = data.actionType;
        if (data.description !== undefined) updateData.description = data.description;
        await updateActionStep(id, updateData as any);
        return { success: true };
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        await deleteActionStep(input.id);
        return { success: true };
      }),

    bulkCreate: publicProcedure
      .input(z.object({
        workstationId: z.number().int().positive(),
        steps: z.array(z.object({
          stepName: z.string().min(1),
          stepOrder: z.number().int().min(0),
          duration: z.number().positive(),
          actionType: z.enum(["value_added", "non_value_added", "necessary_waste"]).optional(),
          description: z.string().optional(),
        })),
      }))
      .mutation(async ({ input }) => {
        const data = input.steps.map(s => ({
          workstationId: input.workstationId,
          stepName: s.stepName,
          stepOrder: s.stepOrder,
          duration: s.duration.toString(),
          actionType: s.actionType ?? ("value_added" as const),
          description: s.description ?? null,
        }));
        await bulkCreateActionSteps(data);
        return { success: true, count: data.length };
      }),
  }),

  // ─── AI Analysis ─────────────────────────────────────────────────────────
  analysis: router({
    aiSuggest: publicProcedure
      .input(z.object({
        productionLineId: z.number().int().positive(),
        productionLineName: z.string(),
        targetCycleTime: z.number().optional(),
        workstations: z.array(z.object({
          name: z.string(),
          cycleTime: z.number(),
          manpower: z.number(),
          sequenceOrder: z.number(),
        })),
      }))
      .mutation(async ({ input }) => {
        // 本地部署：若未設定 OLLAMA_API_KEY，回傳友善錯誤訊息
        if (!ENV.ollamaApiKey) {
          throw new Error('AI 分析功能需要設定 OLLAMA_API_KEY 環境變數。請在 .env 檔案中設定 OLLAMA_API_KEY，並確認本地 Ollama 服務已啟動（預設 http://localhost:11434）。');
        }
        const bottleneck = input.workstations.reduce((max, w) =>
          w.cycleTime > max.cycleTime ? w : max, input.workstations[0]);
        const totalTime = input.workstations.reduce((sum, w) => sum + w.cycleTime, 0);
        const avgTime = totalTime / input.workstations.length;
        const maxTime = Math.max(...input.workstations.map(w => w.cycleTime));
        const balanceRate = input.workstations.length > 0
          ? ((totalTime / (maxTime * input.workstations.length)) * 100).toFixed(1)
          : "0";

        const taktTimeInfo = input.targetCycleTime
          ? `\n**目標節拍時間（Takt Time）：** ${input.targetCycleTime}s（每小時目標產能：${Math.floor(3600 / input.targetCycleTime)} 件）`
          : "\n**目標節拍時間：** 未設定";

        const exceedStations = input.targetCycleTime
          ? input.workstations.filter(w => w.cycleTime > input.targetCycleTime!)
          : [];
        const passStations = input.targetCycleTime
          ? input.workstations.filter(w => w.cycleTime <= input.targetCycleTime!)
          : [];
        const taktPassRate = input.targetCycleTime && input.workstations.length > 0
          ? ((passStations.length / input.workstations.length) * 100).toFixed(1)
          : null;

        const workstationList = input.workstations
          .sort((a, b) => a.sequenceOrder - b.sequenceOrder)
          .map(w => {
            const taktStatus = input.targetCycleTime
              ? (w.cycleTime > input.targetCycleTime
                ? ` ⚠️ 超出 Takt Time +${(w.cycleTime - input.targetCycleTime).toFixed(1)}s`
                : ` ✓ 達標 (${((w.cycleTime / input.targetCycleTime) * 100).toFixed(0)}%)`)
              : "";
            return `  - ${w.name}：工序時間 ${w.cycleTime}s，人員 ${w.manpower} 人${taktStatus}`;
          })
          .join("\n");

        const taktSummary = input.targetCycleTime && taktPassRate
          ? `\n**Takt Time 達標率：** ${taktPassRate}% (${passStations.length}/${input.workstations.length} 工站達標)\n**超出 Takt Time 工站：** ${exceedStations.length > 0 ? exceedStations.map(w => `${w.name}(${w.cycleTime}s)`).join('、') : '無'}`
          : "";

        const prompt = `你是一位精通精實生產（Lean Manufacturing）和工業工程的專家顧問。請根據以下產線數據，提供專業的平衡優化建議：

**產線名稱：** ${input.productionLineName}${taktTimeInfo}
**工站數量：** ${input.workstations.length} 個
**瓶頸工站：** ${bottleneck?.name ?? "無"} (${bottleneck?.cycleTime ?? 0}s)
**平均工序時間：** ${avgTime.toFixed(1)}s
**產線平衡率：** ${balanceRate}%${taktSummary}

**各工站資料（含 Takt Time 達標狀態）：**
${workstationList}

請提供以下分析（使用繁體中文，格式清晰）：

## 1. 現況診斷
分析目前產線的主要問題和瓶頸，特別說明 Takt Time 達標情況（若有設定）。

## 2. Takt Time 達標改善方案
${input.targetCycleTime ? '針對超出 Takt Time 的工站，提出具體的工序壓縮或人員調配方案。' : '建議設定合理的 Takt Time，並說明如何依客戶需求計算。'}

## 3. 平衡優化建議
具體說明如何重新分配工序、調整人員配置以提升平衡率。

## 4. 瓶頸改善方案
針對瓶頸工站提出3-5個具體可行的改善措施。

## 5. 預期效益
估算優化後的平衡率提升、Takt Time 達標率改善和效率提升幅度。

## 6. 實施優先順序
按重要性排列改善項目的實施順序。`;

        // 呼叫 Ollama API（OpenAI 相容格式）
        const ollamaRes = await fetch(`${ENV.ollamaBaseUrl}/api/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${ENV.ollamaApiKey}`,
          },
          body: JSON.stringify({
            model: ENV.ollamaModel,
            messages: [
              { role: "system", content: "你是一位精通精實生產（Lean Manufacturing）和工業工程的專家顧問，擅長產線平衡分析和改善建議。請用繁體中文回答，格式清晰專業。" },
              { role: "user", content: prompt },
            ],
            stream: false,
          }),
        });

        if (!ollamaRes.ok) {
          const errText = await ollamaRes.text();
          throw new Error(`Ollama API 錯誤 (${ollamaRes.status}): ${errText}`);
        }

        const ollamaData = await ollamaRes.json() as {
          message?: { content?: string };
          error?: string;
        };

        const content = ollamaData.message?.content ?? "無法生成建議，請稍後再試。";
        return { suggestion: content };
      }),
  }),

  // ─── Snapshot Router ──────────────────────────────────────────────────────
  snapshot: router({
    listByLine: publicProcedure
      .input(z.object({ productionLineId: z.number().int().positive() }))
      .query(async ({ input }) => {
        const rows = await getSnapshotsByLine(input.productionLineId);
        return rows.map(r => ({
          ...r,
          balanceRate: Number(r.balanceRate),
          balanceLoss: Number(r.balanceLoss),
          totalTime: Number(r.totalTime),
          maxTime: Number(r.maxTime),
          minTime: Number(r.minTime),
          avgTime: Number(r.avgTime),
          taktTime: r.taktTime ? Number(r.taktTime) : null,
          taktPassRate: r.taktPassRate ? Number(r.taktPassRate) : null,
          upph: r.upph ? Number(r.upph) : null,
        }));
      }),

    getById: publicProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ input }) => {
        const row = await getSnapshotById(input.id);
        if (!row) throw new Error("Snapshot not found");
        return {
          ...row,
          balanceRate: Number(row.balanceRate),
          balanceLoss: Number(row.balanceLoss),
          totalTime: Number(row.totalTime),
          maxTime: Number(row.maxTime),
          minTime: Number(row.minTime),
          avgTime: Number(row.avgTime),
          taktTime: row.taktTime ? Number(row.taktTime) : null,
          taktPassRate: row.taktPassRate ? Number(row.taktPassRate) : null,
          upph: row.upph ? Number(row.upph) : null,
        };
      }),

    create: publicProcedure
      .input(z.object({
        productionLineId: z.number().int().positive(),
        name: z.string().min(1).max(255),
        note: z.string().optional(),
        balanceRate: z.number(),
        balanceLoss: z.number(),
        totalTime: z.number(),
        maxTime: z.number(),
        minTime: z.number(),
        avgTime: z.number(),
        workstationCount: z.number().int(),
        totalManpower: z.number().min(0),
        taktTime: z.number().optional(),
        taktPassRate: z.number().optional(),
        taktPassCount: z.number().int().optional(),
        workstationsData: z.array(z.object({
          id: z.number(),
          name: z.string(),
          cycleTime: z.number(),
          manpower: z.number(),
          sequenceOrder: z.number(),
          description: z.string().optional(),
        })),
        bottleneckName: z.string().optional(),
        upph: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        // 自動查詢各工站的動作拆解資料並計算增値率
        const enrichedWorkstations = await Promise.all(
          input.workstationsData.map(async (ws) => {
            const steps = await getActionStepsByWorkstation(ws.id);
            const totalStepSec = steps.reduce((s, st) => s + parseFloat(String(st.duration)), 0);
            const valueAddedSec = steps
              .filter(s => s.actionType === 'value_added')
              .reduce((s, st) => s + parseFloat(String(st.duration)), 0);
            const nonValueAddedSec = steps
              .filter(s => s.actionType === 'non_value_added')
              .reduce((s, st) => s + parseFloat(String(st.duration)), 0);
            const necessaryWasteSec = steps
              .filter(s => s.actionType === 'necessary_waste')
              .reduce((s, st) => s + parseFloat(String(st.duration)), 0);
            const valueAddedRate = totalStepSec > 0
              ? parseFloat(((valueAddedSec / totalStepSec) * 100).toFixed(2))
              : null;
            return {
              ...ws,
              // 動作拆解摘要
              actionStepCount: steps.length,
              totalStepSec: parseFloat(totalStepSec.toFixed(2)),
              valueAddedSec: parseFloat(valueAddedSec.toFixed(2)),
              nonValueAddedSec: parseFloat(nonValueAddedSec.toFixed(2)),
              necessaryWasteSec: parseFloat(necessaryWasteSec.toFixed(2)),
              valueAddedRate,  // null 表示該工站無動作拆解資料
            };
          })
        );
        await createSnapshot({
          productionLineId: input.productionLineId,
          name: input.name,
          note: input.note ?? null,
          balanceRate: String(input.balanceRate),
          balanceLoss: String(input.balanceLoss),
          totalTime: String(input.totalTime),
          maxTime: String(input.maxTime),
          minTime: String(input.minTime),
          avgTime: String(input.avgTime),
          workstationCount: input.workstationCount,
          totalManpower: input.totalManpower,
          taktTime: input.taktTime != null ? String(input.taktTime) : null,
          taktPassRate: input.taktPassRate != null ? String(input.taktPassRate) : null,
          taktPassCount: input.taktPassCount ?? null,
          workstationsData: enrichedWorkstations,
          bottleneckName: input.bottleneckName ?? null,
          upph: input.upph != null ? String(input.upph) : null,
        });
        return { success: true };
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        await deleteSnapshot(input.id);
        return { success: true };
      }),

    updateData: protectedProcedure
      .input(z.object({
        id: z.number().int().positive(),
        name: z.string().min(1).max(255).optional(),
        note: z.string().nullable().optional(),
        taktTime: z.number().positive().nullable().optional(),
        workstationsData: z.array(z.object({
          id: z.number(),
          name: z.string().min(1),
          cycleTime: z.number().positive(),
          manpower: z.number().min(0.5),
          sequenceOrder: z.number().int().min(0),
          description: z.string().optional(),
          actionStepCount: z.number().optional(),
          totalStepSec: z.number().optional(),
          valueAddedSec: z.number().optional(),
          nonValueAddedSec: z.number().optional(),
          necessaryWasteSec: z.number().optional(),
          valueAddedRate: z.number().nullable().optional(),
        })).min(1),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await updateSnapshotData(id, data);
        return { success: true };
      }),

    getAllLinesLatest: publicProcedure
      .query(async () => {
        const rows = await getAllLinesLatestSnapshot();
        return rows;
      }),
    getAllLinesHistory: publicProcedure
      .query(async () => {
        const rows = await getAllLinesSnapshotHistory();
        return rows;
      }),
  }),

  // ─── Hand Actions ────────────────────────────────────────────────────────────────────────────────────
  handAction: router({
    // 取得單一動作步驟的左右手記錄
    listByStep: publicProcedure
      .input(z.object({ actionStepId: z.number().int().positive() }))
      .query(async ({ input }) => {
        return getHandActionsByStep(input.actionStepId);
      }),

    // 批次取得多個動作步驟的左右手記錄（用於工站整體載入）
    listByStepIds: publicProcedure
      .input(z.object({ actionStepIds: z.array(z.number().int().positive()) }))
      .query(async ({ input }) => {
        return getHandActionsByStepIds(input.actionStepIds);
      }),

    // 新增或更新一筆手部動作記錄
    upsert: publicProcedure
      .input(z.object({
        id: z.number().int().positive().optional(),
        actionStepId: z.number().int().positive(),
        hand: z.enum(["left", "right"]),
        actionName: z.string().min(1),
        duration: z.number().min(0),
        handActionType: z.enum(["value_added", "non_value_added", "necessary_waste", "idle"]).optional(),
        isIdle: z.boolean().optional(),
        note: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const result = await upsertHandAction({
          id: input.id,
          actionStepId: input.actionStepId,
          hand: input.hand,
          actionName: input.actionName,
          duration: input.duration.toString(),
          handActionType: input.handActionType ?? "value_added",
          isIdle: input.isIdle ? 1 : 0,
          note: input.note ?? null,
        });
        return { success: true, insertId: (result as any)?.insertId };
      }),

    // 刪除單筆手部動作記錄
    delete: publicProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        await deleteHandAction(input.id);
        return { success: true };
      }),

    // 刪除某動作步驟的所有手部記錄（删除步驟時一並清除）
    deleteByStep: publicProcedure
      .input(z.object({ actionStepId: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        await deleteHandActionsByStep(input.actionStepId);
        return { success: true };
      }),
  }),

  // ─── Simulation Scenarios ────────────────────────────────────────────────────────
  simulation: router({
    // 列出指定產線的所有情境
    list: publicProcedure
      .input(z.object({ productionLineId: z.number().int().positive() }))
      .query(async ({ input }) => {
        const rows = await listSimulations(input.productionLineId);
        return rows.map(r => ({
          ...r,
          workstationsData: r.workstationsData as SimWorkstation[],
        }));
      }),

    // 取得單一情境
    getById: publicProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ input }) => {
        const row = await getSimulationById(input.id);
        if (!row) throw new Error("Simulation not found");
        return { ...row, workstationsData: row.workstationsData as SimWorkstation[] };
      }),

    // 建立新情境（從產線工站或快照載入基準數據）
    create: publicProcedure
      .input(z.object({
        productionLineId: z.number().int().positive(),
        name: z.string().min(1).max(255),
        baseSnapshotId: z.number().int().positive().optional(),
        // 支援舊格式（陣列）和新格式（FloorLayout 物件）
        workstationsData: z.union([
          z.array(z.any()),
          z.object({
            workstations: z.array(z.any()),
            connections: z.array(z.any()),
          }),
        ]),
        notes: z.string().optional(),
        createdBy: z.number().int().positive().optional(),
      }))
      .mutation(async ({ input }) => {
        const scenario = await createSimulation({
          productionLineId: input.productionLineId,
          name: input.name,
          baseSnapshotId: input.baseSnapshotId ?? null,
          workstationsData: input.workstationsData as any,
          notes: input.notes ?? null,
          createdBy: input.createdBy ?? null,
        });
        return { success: true, scenario };
      }),

    // 更新情境（工站數據、名稱、備註）
    update: publicProcedure
      .input(z.object({
        id: z.number().int().positive(),
        name: z.string().min(1).max(255).optional(),
        notes: z.string().optional(),
        // 支援舊格式（陣列）和新格式（FloorLayout 物件）
        workstationsData: z.union([
          z.array(z.any()),
          z.object({
            workstations: z.array(z.any()),
            connections: z.array(z.any()),
          }),
        ]).optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        const updateData: Record<string, unknown> = {};
        if (data.name !== undefined) updateData.name = data.name;
        if (data.notes !== undefined) updateData.notes = data.notes;
        if (data.workstationsData !== undefined) updateData.workstationsData = data.workstationsData;
        const scenario = await updateSimulation(id, updateData as any);
        return { success: true, scenario };
      }),

    // 删除情境
    delete: publicProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        await deleteSimulation(input.id);
        return { success: true };
      }),

    // 複製情境
    duplicate: publicProcedure
      .input(z.object({
        id: z.number().int().positive(),
        newName: z.string().min(1).max(255),
      }))
      .mutation(async ({ input }) => {
        const original = await getSimulationById(input.id);
        if (!original) throw new Error("Simulation not found");
        const scenario = await createSimulation({
          productionLineId: original.productionLineId,
          name: input.newName,
          baseSnapshotId: original.baseSnapshotId ?? null,
          workstationsData: original.workstationsData,
          notes: original.notes ? `複製自「${original.name}」` : null,
          createdBy: original.createdBy ?? null,
        });
        return { success: true, scenario };
      }),

    // 將情境工站數據寫回實際 workstations 表
    applyToLine: protectedProcedure
      .input(z.object({
        scenarioId: z.number().int().positive(),
      }))
      .mutation(async ({ input }) => {
        const scenario = await getSimulationById(input.scenarioId);
        if (!scenario) throw new Error("Simulation not found");
        const rawData = scenario.workstationsData as any;

        // 支援舊格式（陣列）和新格式（FloorLayout 物件）
        const wsArray: any[] = Array.isArray(rawData)
          ? rawData
          : (rawData?.workstations ?? []);

        // 將 FloorWs 格式轉換為 SimWorkstation 格式
        const wsData: SimWorkstation[] = wsArray.map((w: any) => ({
          id: w.id,
          name: w.name,
          // 新格式：工序時間 = max(operatorTime, machineTime)
          cycleTime: w.cycleTime ?? Math.max(w.operatorTime ?? 0, w.machineTime ?? 0),
          manpower: w.manpower,
          sequenceOrder: w.sequenceOrder,
          description: w.description,
        }));

        // 取得產線現有工站
        const existingWs = await getWorkstationsByLine(scenario.productionLineId);

        // 對比情境工站 vs 現有工站，建立變更清單
        const changes: Array<{ type: 'update' | 'add' | 'remove'; ws: SimWorkstation | any }> = [];

        // 找出需要更新的工站（按 id 對比）
        for (const simWs of wsData) {
          if (simWs.id > 0) {
            const existing = existingWs.find(w => w.id === simWs.id);
            if (existing) {
              changes.push({ type: 'update', ws: simWs });
            } else {
              changes.push({ type: 'add', ws: simWs });
            }
          } else {
            // id <= 0 表示新工站
            changes.push({ type: 'add', ws: simWs });
          }
        }

        // 找出需要刪除的工站（現有工站中不在情境工站列表的）
        const simIds = new Set(wsData.filter(w => w.id > 0).map(w => w.id));
        for (const ew of existingWs) {
          if (!simIds.has(ew.id)) {
            changes.push({ type: 'remove', ws: ew });
          }
        }

        // 執行變更
        for (const change of changes) {
          if (change.type === 'update') {
            await updateWorkstation(change.ws.id, {
              name: change.ws.name,
              cycleTime: change.ws.cycleTime.toString(),
              manpower: change.ws.manpower.toString(),
              sequenceOrder: change.ws.sequenceOrder,
              description: change.ws.description ?? null,
            });
          } else if (change.type === 'add') {
            await createWorkstation({
              productionLineId: scenario.productionLineId,
              name: change.ws.name,
              cycleTime: change.ws.cycleTime.toString(),
              manpower: change.ws.manpower.toString(),
              sequenceOrder: change.ws.sequenceOrder,
              description: change.ws.description ?? null,
              notes: null,
            });
          } else if (change.type === 'remove') {
            await deleteWorkstation(change.ws.id);
          }
        }

        return {
          success: true,
          applied: changes.length,
          updated: changes.filter(c => c.type === 'update').length,
          added: changes.filter(c => c.type === 'add').length,
          removed: changes.filter(c => c.type === 'remove').length,
        };
      }),

    // 更新 DXF 底圖設定
    updateBackground: protectedProcedure
      .input(z.object({
        id: z.number().int().positive(),
        backgroundSvg: z.string().nullable().optional(),
        backgroundLayers: z.array(z.object({
          name: z.string(),
          visible: z.boolean(),
          color: z.string().optional(),
        })).optional(),
        backgroundOpacity: z.number().min(0).max(1).optional(),
        backgroundOffsetX: z.number().optional(),
        backgroundOffsetY: z.number().optional(),
        backgroundScale: z.number().positive().optional(),
        backgroundFileName: z.string().nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, backgroundOpacity, backgroundOffsetX, backgroundOffsetY, backgroundScale, ...rest } = input;
        const scenario = await updateScenarioBackground(id, {
          ...rest,
          ...(backgroundOpacity !== undefined && { backgroundOpacity: backgroundOpacity.toFixed(2) }),
          ...(backgroundOffsetX !== undefined && { backgroundOffsetX: backgroundOffsetX.toFixed(2) }),
          ...(backgroundOffsetY !== undefined && { backgroundOffsetY: backgroundOffsetY.toFixed(2) }),
          ...(backgroundScale !== undefined && { backgroundScale: backgroundScale.toFixed(4) }),
        });
        return { success: true, scenario };
      }),
  }),

  // ─── Product Models ────────────────────────────────────────────────────────────────────────────────
  productModel: router({
    listByLine: protectedProcedure
      .input(z.object({ productionLineId: z.number() }))
      .query(async ({ input }) => getProductModelsByLine(input.productionLineId)),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => getProductModelById(input.id)),

    create: protectedProcedure
      .input(z.object({
        productionLineId: z.number(),
        modelCode: z.string().min(1).max(64),
        modelName: z.string().min(1).max(255),
        targetCycleTime: z.number().positive().nullable().optional(),
        batchSize: z.number().int().positive().optional(),
        description: z.string().nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        const model = await createProductModel({
          ...input,
          targetCycleTime: input.targetCycleTime != null ? String(input.targetCycleTime) : null,
        });
        return { success: true, model };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        modelCode: z.string().min(1).max(64).optional(),
        modelName: z.string().min(1).max(255).optional(),
        targetCycleTime: z.number().positive().nullable().optional(),
        batchSize: z.number().int().positive().optional(),
        description: z.string().nullable().optional(),
        isActive: z.number().int().min(0).max(1).optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, targetCycleTime, ...rest } = input;
        const model = await updateProductModel(id, {
          ...rest,
          ...(targetCycleTime !== undefined && { targetCycleTime: targetCycleTime != null ? String(targetCycleTime) : null }),
        });
        return { success: true, model };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteProductModel(input.id);
        return { success: true };
      }),
  }),

  // ─── Product Tracking ───────────────────────────────────────────────────────────────
  productTracking: router({
    // 產品個體管理
    listInstances: protectedProcedure
      .input(z.object({ productionLineId: z.number() }))
      .query(async ({ input }) => listProductInstances(input.productionLineId)),

    getInstance: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => getProductInstanceById(input.id)),

    createInstance: protectedProcedure
      .input(z.object({
        productionLineId: z.number(),
        productModelId: z.number().optional(),
        serialNumber: z.string().min(1),
        batchNumber: z.string().optional(),
        status: z.enum(["in_progress", "completed", "rework", "scrapped"]).optional(),
        startTime: z.date().optional(),
        endTime: z.date().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const instance = await createProductInstance(input as any);
        return { success: true, instance };
      }),

    updateInstance: protectedProcedure
      .input(z.object({
        id: z.number(),
        serialNumber: z.string().min(1).optional(),
        batchNumber: z.string().optional(),
        status: z.enum(["in_progress", "completed", "rework", "scrapped"]).optional(),
        startTime: z.date().optional().nullable(),
        endTime: z.date().optional().nullable(),
        totalLeadTime: z.number().optional().nullable(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        const instance = await updateProductInstance(id, data as any);
        return { success: true, instance };
      }),

    deleteInstance: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteProductInstance(input.id);
        return { success: true };
      }),

    // 流程記錄管理
    listFlowRecords: protectedProcedure
      .input(z.object({ productInstanceId: z.number() }))
      .query(async ({ input }) => listFlowRecordsByInstance(input.productInstanceId)),

    createFlowRecord: protectedProcedure
      .input(z.object({
        productInstanceId: z.number(),
        workstationId: z.number(),
        workstationName: z.string(),
        sequenceOrder: z.number().default(0),
        entryTime: z.date().optional().nullable(),
        exitTime: z.date().optional().nullable(),
        actualCycleTime: z.number().optional().nullable(),
        waitTime: z.number().optional().default(0),
        status: z.enum(["normal", "rework", "waiting", "skipped"]).optional(),
        operatorName: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const record = await createFlowRecord(input as any);
        return { success: true, record };
      }),

    updateFlowRecord: protectedProcedure
      .input(z.object({
        id: z.number(),
        entryTime: z.date().optional().nullable(),
        exitTime: z.date().optional().nullable(),
        actualCycleTime: z.number().optional().nullable(),
        waitTime: z.number().optional(),
        status: z.enum(["normal", "rework", "waiting", "skipped"]).optional(),
        operatorName: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        const record = await updateFlowRecord(id, data as any);
        return { success: true, record };
      }),

    deleteFlowRecord: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteFlowRecord(input.id);
        return { success: true };
      }),

    upsertFlowRecords: protectedProcedure
      .input(z.object({
        productInstanceId: z.number(),
        records: z.array(z.object({
          productInstanceId: z.number(),
          workstationId: z.number(),
          workstationName: z.string(),
          sequenceOrder: z.number().default(0),
          entryTime: z.date().optional().nullable(),
          exitTime: z.date().optional().nullable(),
          actualCycleTime: z.number().optional().nullable(),
          waitTime: z.number().optional().default(0),
          status: z.enum(["normal", "rework", "waiting", "skipped"]).optional(),
          operatorName: z.string().optional(),
          notes: z.string().optional(),
        }))
      }))
      .mutation(async ({ input }) => {
        const records = await upsertFlowRecords(input.productInstanceId, input.records as any);
        return { success: true, records };
      }),
  }),
});
export type AppRouter = typeof appRouter;

// 工站資料型別（情境用）
type SimWorkstation = {
  id: number;
  name: string;
  cycleTime: number;
  manpower: number;
  sequenceOrder: number;
  description?: string;
};
