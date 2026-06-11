-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organization" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "datasetType" TEXT NOT NULL,
    "accessMethod" TEXT NOT NULL,
    "license" TEXT,
    "limitations" TEXT,
    "fieldsCollected" TEXT,
    "archivePath" TEXT,
    "processingScript" TEXT,
    "contact" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "category" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceDocument" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "docType" TEXT NOT NULL,
    "rawPath" TEXT,
    "contentHash" TEXT,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "httpStatus" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScrapeRun" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "recordsFound" INTEGER NOT NULL DEFAULT 0,
    "pagesFetched" INTEGER NOT NULL DEFAULT 0,
    "failures" INTEGER NOT NULL DEFAULT 0,
    "failedUrls" TEXT,
    "log" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScrapeRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Atoll" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dhivehiName" TEXT,
    "naturalAtoll" TEXT,
    "region" TEXT,
    "centroidLat" DOUBLE PRECISION,
    "centroidLng" DOUBLE PRECISION,
    "geometry" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Atoll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Island" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dhivehiName" TEXT,
    "atollId" TEXT,
    "status" TEXT,
    "islandType" TEXT,
    "useCategory" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "areaSqKm" DOUBLE PRECISION,
    "identityScore" INTEGER NOT NULL DEFAULT 0,
    "geometryScore" INTEGER NOT NULL DEFAULT 0,
    "populationScore" INTEGER NOT NULL DEFAULT 0,
    "environmentScore" INTEGER NOT NULL DEFAULT 0,
    "infrastructureScore" INTEGER NOT NULL DEFAULT 0,
    "sourceScore" INTEGER NOT NULL DEFAULT 0,
    "overallScore" INTEGER NOT NULL DEFAULT 0,
    "unresolvedConflicts" INTEGER NOT NULL DEFAULT 0,
    "lastUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Island_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IslandName" (
    "id" TEXT NOT NULL,
    "islandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameType" TEXT NOT NULL,
    "sourceSlug" TEXT,

    CONSTRAINT "IslandName_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IslandGeometry" (
    "id" TEXT NOT NULL,
    "islandId" TEXT NOT NULL,
    "sourceSlug" TEXT NOT NULL,
    "geomType" TEXT NOT NULL,
    "geometry" TEXT NOT NULL,
    "areaSqKm" DOUBLE PRECISION,
    "fetchedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IslandGeometry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IslandPopulation" (
    "id" TEXT NOT NULL,
    "islandId" TEXT NOT NULL,
    "sourceSlug" TEXT NOT NULL,
    "censusYear" INTEGER,
    "total" INTEGER,
    "male" INTEGER,
    "female" INTEGER,
    "resident" INTEGER,
    "registered" INTEGER,
    "households" INTEGER,
    "rawRecord" TEXT,
    "fetchedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IslandPopulation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IslandImage" (
    "id" TEXT NOT NULL,
    "islandId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "localPath" TEXT,
    "caption" TEXT,
    "sourceSlug" TEXT NOT NULL,

    CONSTRAINT "IslandImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FieldValue" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceDocumentId" TEXT,
    "rawValue" TEXT,
    "normalizedValue" TEXT,
    "canonicalCandidate" BOOLEAN NOT NULL DEFAULT false,
    "isCanonical" BOOLEAN NOT NULL DEFAULT false,
    "canonicalReason" TEXT,
    "selectedBy" TEXT,
    "dateSelected" TIMESTAMP(3),
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "verificationStatus" TEXT NOT NULL DEFAULT 'unverified',
    "dateScraped" TIMESTAMP(3) NOT NULL,
    "datePublished" TIMESTAMP(3),
    "dateVerified" TIMESTAMP(3),
    "sourceUrl" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FieldValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataConflict" (
    "id" TEXT NOT NULL,
    "islandId" TEXT,
    "entityType" TEXT NOT NULL DEFAULT 'island',
    "entityId" TEXT,
    "fieldName" TEXT NOT NULL,
    "conflictType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'unresolved',
    "canonicalValue" TEXT,
    "sourceValues" TEXT NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "reviewerNote" TEXT,
    "reviewedBy" TEXT,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataConflict_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IslandMatch" (
    "id" TEXT NOT NULL,
    "islandId" TEXT NOT NULL,
    "sourceSlug" TEXT NOT NULL,
    "sourceRecordKey" TEXT NOT NULL,
    "matchMethod" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IslandMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminCorrection" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "submittedBy" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminCorrection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Snapshot" (
    "id" TEXT NOT NULL,
    "snapshotDate" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "gitCommitHash" TEXT,
    "appVersion" TEXT,
    "schemaVersion" TEXT,
    "totalIslands" INTEGER NOT NULL DEFAULT 0,
    "totalAtolls" INTEGER NOT NULL DEFAULT 0,
    "totalPopulation" INTEGER NOT NULL DEFAULT 0,
    "totalConflicts" INTEGER NOT NULL DEFAULT 0,
    "manifest" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SnapshotFile" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,

    CONSTRAINT "SnapshotFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Source_slug_key" ON "Source"("slug");

-- CreateIndex
CREATE INDEX "SourceDocument_sourceId_idx" ON "SourceDocument"("sourceId");

-- CreateIndex
CREATE INDEX "ScrapeRun_sourceId_idx" ON "ScrapeRun"("sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "Atoll_code_key" ON "Atoll"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Island_slug_key" ON "Island"("slug");

-- CreateIndex
CREATE INDEX "Island_atollId_idx" ON "Island"("atollId");

-- CreateIndex
CREATE INDEX "Island_name_idx" ON "Island"("name");

-- CreateIndex
CREATE INDEX "IslandName_islandId_idx" ON "IslandName"("islandId");

-- CreateIndex
CREATE INDEX "IslandGeometry_islandId_idx" ON "IslandGeometry"("islandId");

-- CreateIndex
CREATE INDEX "IslandPopulation_islandId_idx" ON "IslandPopulation"("islandId");

-- CreateIndex
CREATE INDEX "IslandImage_islandId_idx" ON "IslandImage"("islandId");

-- CreateIndex
CREATE INDEX "FieldValue_entityType_entityId_fieldName_idx" ON "FieldValue"("entityType", "entityId", "fieldName");

-- CreateIndex
CREATE INDEX "FieldValue_sourceId_idx" ON "FieldValue"("sourceId");

-- CreateIndex
CREATE INDEX "FieldValue_fieldName_idx" ON "FieldValue"("fieldName");

-- CreateIndex
CREATE INDEX "DataConflict_islandId_idx" ON "DataConflict"("islandId");

-- CreateIndex
CREATE INDEX "DataConflict_status_idx" ON "DataConflict"("status");

-- CreateIndex
CREATE INDEX "DataConflict_fieldName_idx" ON "DataConflict"("fieldName");

-- CreateIndex
CREATE INDEX "DataConflict_severity_idx" ON "DataConflict"("severity");

-- CreateIndex
CREATE INDEX "IslandMatch_islandId_idx" ON "IslandMatch"("islandId");

-- CreateIndex
CREATE INDEX "IslandMatch_needsReview_idx" ON "IslandMatch"("needsReview");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Snapshot_snapshotDate_key" ON "Snapshot"("snapshotDate");

-- CreateIndex
CREATE INDEX "SnapshotFile_snapshotId_idx" ON "SnapshotFile"("snapshotId");

-- AddForeignKey
ALTER TABLE "SourceDocument" ADD CONSTRAINT "SourceDocument_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScrapeRun" ADD CONSTRAINT "ScrapeRun_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Island" ADD CONSTRAINT "Island_atollId_fkey" FOREIGN KEY ("atollId") REFERENCES "Atoll"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IslandName" ADD CONSTRAINT "IslandName_islandId_fkey" FOREIGN KEY ("islandId") REFERENCES "Island"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IslandGeometry" ADD CONSTRAINT "IslandGeometry_islandId_fkey" FOREIGN KEY ("islandId") REFERENCES "Island"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IslandPopulation" ADD CONSTRAINT "IslandPopulation_islandId_fkey" FOREIGN KEY ("islandId") REFERENCES "Island"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IslandImage" ADD CONSTRAINT "IslandImage_islandId_fkey" FOREIGN KEY ("islandId") REFERENCES "Island"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldValue" ADD CONSTRAINT "FieldValue_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldValue" ADD CONSTRAINT "FieldValue_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "SourceDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataConflict" ADD CONSTRAINT "DataConflict_islandId_fkey" FOREIGN KEY ("islandId") REFERENCES "Island"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IslandMatch" ADD CONSTRAINT "IslandMatch_islandId_fkey" FOREIGN KEY ("islandId") REFERENCES "Island"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SnapshotFile" ADD CONSTRAINT "SnapshotFile_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "Snapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

