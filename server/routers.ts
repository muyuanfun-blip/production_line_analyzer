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
} from "./db";
import { invokeLLM } from "./_core/llm";

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
  manpower: z.number().int().positive().optional(),
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
          manpower: input.manpower ?? 1,
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
          manpower: z.number().int().positive().optional(),
          description: z.string().optional(),
        })),
      }))
      .mutation(async ({ input }) => {
        const data = input.workstations.map(w => ({
          productionLineId: input.productionLineId,
          name: w.name,
          sequenceOrder: w.sequenceOrder,
          cycleTime: w.cycleTime.toString(),
          manpower: w.manpower ?? 1,
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
        const bottleneck = input.workstations.reduce((max, w) =>
          w.cycleTime > max.cycleTime ? w : max, input.workstations[0]);
        const totalTime = input.workstations.reduce((sum, w) => sum + w.cycleTime, 0);
        const avgTime = totalTime / input.workstations.length;
        const maxTime = Math.max(...input.workstations.map(w => w.cycleTime));
        const balanceRate = input.workstations.length > 0
          ? ((totalTime / (maxTime * input.workstations.length)) * 100).toFixed(1)
          : "0";

        const workstationList = input.workstations
          .sort((a, b) => a.sequenceOrder - b.sequenceOrder)
          .map(w => `  - ${w.name}：工序時間 ${w.cycleTime}s，人員 ${w.manpower} 人`)
          .join("\n");

        const prompt = `你是一位精通精實生產（Lean Manufacturing）和工業工程的專家顧問。請根據以下產線數據，提供專業的平衡優化建議：

**產線名稱：** ${input.productionLineName}
**目標節拍時間：** ${input.targetCycleTime ? input.targetCycleTime + "s" : "未設定"}
**工站數量：** ${input.workstations.length} 個
**瓶頸工站：** ${bottleneck?.name ?? "無"} (${bottleneck?.cycleTime ?? 0}s)
**平均工序時間：** ${avgTime.toFixed(1)}s
**產線平衡率：** ${balanceRate}%

**各工站資料：**
${workstationList}

請提供以下分析（使用繁體中文，格式清晰）：

## 1. 現況診斷
分析目前產線的主要問題和瓶頸。

## 2. 平衡優化建議
具體說明如何重新分配工序、調整人員配置以提升平衡率。

## 3. 瓶頸改善方案
針對瓶頸工站提出3-5個具體可行的改善措施。

## 4. 預期效益
估算優化後的平衡率提升和效率改善幅度。

## 5. 實施優先順序
按重要性排列改善項目的實施順序。`;

        const response = await invokeLLM({
          messages: [
            { role: "system", content: "你是一位精通精實生產和工業工程的專家顧問，擅長產線平衡分析和改善建議。請用繁體中文回答，格式清晰專業。" },
            { role: "user", content: prompt },
          ],
        });

        const content = response.choices?.[0]?.message?.content ?? "無法生成建議，請稍後再試。";
        return { suggestion: content };
      }),
  }),
});

export type AppRouter = typeof appRouter;
