CREATE TABLE `claims` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reportId` int NOT NULL,
	`claimText` longtext NOT NULL,
	`sourceChunkIds` json,
	`confidenceTier` enum('high','medium','low') NOT NULL,
	`supportingDocuments` json,
	`contradictingDocuments` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `claims_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `contradictions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reportId` int NOT NULL,
	`claim1` longtext NOT NULL,
	`claim2` longtext NOT NULL,
	`source1DocumentId` int NOT NULL,
	`source2DocumentId` int NOT NULL,
	`severity` enum('high','medium','low') NOT NULL,
	`resolution` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `contradictions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `documentSummaries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`documentId` int NOT NULL,
	`keyClaims` json,
	`entities` json,
	`dates` json,
	`contradictions` json,
	`confidenceScores` json,
	`summary` longtext,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `documentSummaries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`fileName` varchar(255) NOT NULL,
	`s3Key` varchar(512) NOT NULL,
	`s3Url` varchar(512) NOT NULL,
	`mimeType` varchar(100),
	`fileSize` int,
	`tokenCount` int,
	`uploadedAt` timestamp NOT NULL DEFAULT (now()),
	`processedAt` timestamp,
	`status` enum('uploading','processing','completed','failed') NOT NULL DEFAULT 'uploading',
	`processingError` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `entities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`type` varchar(100),
	`description` text,
	`mentionCount` int DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `entities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `entityRelationships` (
	`id` int AUTO_INCREMENT NOT NULL,
	`entity1Id` int NOT NULL,
	`entity2Id` int NOT NULL,
	`relationshipType` varchar(100) NOT NULL,
	`strength` decimal(5,4),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `entityRelationships_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `performanceMetrics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`metricType` varchar(100) NOT NULL,
	`value` decimal(10,4),
	`queryId` int,
	`reportId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `performanceMetrics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `retrievalResults` (
	`id` int AUTO_INCREMENT NOT NULL,
	`queryId` varchar(128) NOT NULL,
	`documentId` int NOT NULL,
	`chunkId` varchar(128) NOT NULL,
	`chunkText` longtext,
	`retrievalSource` enum('vector','bm25','graphrag') NOT NULL,
	`relevanceScore` decimal(5,4),
	`cragScore` decimal(5,4),
	`trustScore` decimal(5,4),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `retrievalResults_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `synthesisQueries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`query` longtext NOT NULL,
	`decomposedQueries` json,
	`status` enum('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `synthesisQueries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `synthesisReports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`queryId` int NOT NULL,
	`reportContent` longtext,
	`claims` json,
	`contradictions` json,
	`confidenceMetrics` json,
	`halluccinationScore` decimal(5,4),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `synthesisReports_id` PRIMARY KEY(`id`)
);
