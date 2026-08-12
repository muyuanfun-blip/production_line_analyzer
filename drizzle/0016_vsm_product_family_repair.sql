ALTER TABLE `vsm_diagrams` ADD COLUMN IF NOT EXISTS `productFamily` varchar(255) NULL AFTER `description`;
