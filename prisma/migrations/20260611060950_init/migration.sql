-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SourceDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "docType" TEXT NOT NULL,
    "rawPath" TEXT,
    "contentHash" TEXT,
    "fetchedAt" DATETIME NOT NULL,
    "publishedAt" DATETIME,
    "httpStatus" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SourceDocument_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScrapeRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceId" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL,
    "finishedAt" DATETIME,
    "status" TEXT NOT NULL,
    "recordsFound" INTEGER NOT NULL DEFAULT 0,
    "pagesFetched" INTEGER NOT NULL DEFAULT 0,
    "failures" INTEGER NOT NULL DEFAULT 0,
    "failedUrls" TEXT,
    "log" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScrapeRun_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Atoll" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dhivehiName" TEXT,
    "naturalAtoll" TEXT,
    "region" TEXT,
    "centroidLat" REAL,
    "centroidLng" REAL,
    "geometry" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Island" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dhivehiName" TEXT,
    "atollId" TEXT,
    "status" TEXT,
    "islandType" TEXT,
    "useCategory" TEXT,
    "lat" REAL,
    "lng" REAL,
    "areaSqKm" REAL,
    "identityScore" INTEGER NOT NULL DEFAULT 0,
    "geometryScore" INTEGER NOT NULL DEFAULT 0,
    "populationScore" INTEGER NOT NULL DEFAULT 0,
    "environmentScore" INTEGER NOT NULL DEFAULT 0,
    "infrastructureScore" INTEGER NOT NULL DEFAULT 0,
    "sourceScore" INTEGER NOT NULL DEFAULT 0,
    "overallScore" INTEGER NOT NULL DEFAULT 0,
    "unresolvedConflicts" INTEGER NOT NULL DEFAULT 0,
    "lastUpdatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Island_atollId_fkey" FOREIGN KEY ("atollId") REFERENCES "Atoll" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IslandName" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "islandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameType" TEXT NOT NULL,
    "sourceSlug" TEXT,
    CONSTRAINT "IslandName_islandId_fkey" FOREIGN KEY ("islandId") REFERENCES "Island" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IslandGeometry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "islandId" TEXT NOT NULL,
    "sourceSlug" TEXT NOT NULL,
    "geomType" TEXT NOT NULL,
    "geometry" TEXT NOT NULL,
    "areaSqKm" REAL,
    "fetchedAt" DATETIME NOT NULL,
    CONSTRAINT "IslandGeometry_islandId_fkey" FOREIGN KEY ("islandId") REFERENCES "Island" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IslandPopulation" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "fetchedAt" DATETIME NOT NULL,
    CONSTRAINT "IslandPopulation_islandId_fkey" FOREIGN KEY ("islandId") REFERENCES "Island" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IslandImage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "islandId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "localPath" TEXT,
    "caption" TEXT,
    "sourceSlug" TEXT NOT NULL,
    CONSTRAINT "IslandImage_islandId_fkey" FOREIGN KEY ("islandId") REFERENCES "Island" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FieldValue" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "dateSelected" DATETIME,
    "confidenceScore" REAL NOT NULL DEFAULT 0.5,
    "verificationStatus" TEXT NOT NULL DEFAULT 'unverified',
    "dateScraped" DATETIME NOT NULL,
    "datePublished" DATETIME,
    "dateVerified" DATETIME,
    "sourceUrl" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FieldValue_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FieldValue_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "SourceDocument" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DataConflict" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "islandId" TEXT,
    "entityType" TEXT NOT NULL DEFAULT 'island',
    "entityId" TEXT,
    "fieldName" TEXT NOT NULL,
    "conflictType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'unresolved',
    "canonicalValue" TEXT,
    "sourceValues" TEXT NOT NULL,
    "confidenceScore" REAL NOT NULL DEFAULT 0.5,
    "reviewerNote" TEXT,
    "reviewedBy" TEXT,
    "detectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DataConflict_islandId_fkey" FOREIGN KEY ("islandId") REFERENCES "Island" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IslandMatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "islandId" TEXT NOT NULL,
    "sourceSlug" TEXT NOT NULL,
    "sourceRecordKey" TEXT NOT NULL,
    "matchMethod" TEXT NOT NULL,
    "confidence" REAL NOT NULL,
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "reviewedBy" TEXT,
    "reviewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IslandMatch_islandId_fkey" FOREIGN KEY ("islandId") REFERENCES "Island" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AdminCorrection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "submittedBy" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewedBy" TEXT,
    "reviewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "detail" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Snapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "snapshotDate" TEXT NOT NULL,
    "generatedAt" DATETIME NOT NULL,
    "gitCommitHash" TEXT,
    "appVersion" TEXT,
    "schemaVersion" TEXT,
    "totalIslands" INTEGER NOT NULL DEFAULT 0,
    "totalAtolls" INTEGER NOT NULL DEFAULT 0,
    "totalPopulation" INTEGER NOT NULL DEFAULT 0,
    "totalConflicts" INTEGER NOT NULL DEFAULT 0,
    "manifest" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SnapshotFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "snapshotId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    CONSTRAINT "SnapshotFile_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "Snapshot" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
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
