/**
 * ingest-cloud.js
 * Migrates local data/vector_store.json → Neon PostgreSQL via Prisma raw SQL
 * Run once: node scripts/ingest-cloud.js
 */

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();
const BATCH_SIZE = 100;
const VECTOR_STORE_PATH = path.join(process.cwd(), 'data', 'vector_store.json');

async function main() {
    console.log('🚀 Garuda Cloud Ingest — Migrating to Neon Postgres...\n');

    if (!fs.existsSync(VECTOR_STORE_PATH)) {
        console.error('❌ data/vector_store.json not found. Run `npm run ingest` first.');
        process.exit(1);
    }
    
    console.log('📂 Loading local vector store...');
    const vectors = JSON.parse(fs.readFileSync(VECTOR_STORE_PATH, 'utf8'));
    console.log(`✅ Loaded ${vectors.length} chunks.\n`);

    console.log(`🏗️  Clearing old Scripture records...`);
    await prisma.$executeRaw`TRUNCATE TABLE "Scripture";`;
    console.log(`✅ Table cleared.\n`);

    const totalBatches = Math.ceil(vectors.length / BATCH_SIZE);
    console.log(`📤 Uploading ${vectors.length} vectors in ${totalBatches} batches of ${BATCH_SIZE}...`);

    for (let i = 0; i < vectors.length; i += BATCH_SIZE) {
        const batch = vectors.slice(i, i + BATCH_SIZE);
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;

        // Perform raw inserts
        for (const v of batch) {
            const id = crypto.randomUUID();
            const text = v.text;
            const source = v.source;
            const chunk_index = v.chunk_index;
            const embeddingParam = `[${v.embedding.join(',')}]`;

            await prisma.$executeRaw`
                INSERT INTO "Scripture" (id, text, source, chunk_index, embedding)
                VALUES (${id}, ${text}, ${source}, ${chunk_index}, ${embeddingParam}::vector)
            `;
        }

        process.stdout.write(`\r   Batch ${batchNum}/${totalBatches} uploaded (${Math.min(i + BATCH_SIZE, vectors.length)}/${vectors.length} vectors)`);
    }

    console.log('\n');

    // Verify
    const countQuery = await prisma.$queryRaw`SELECT COUNT(*) as count FROM "Scripture"`;
    // BigInt returned from raw query
    const count = Number(countQuery[0].count);
    
    console.log(`✅ Neon DB reports ${count} vectors stored.`);
    console.log('\n🎉 Migration complete! Garuda AI is now using Neon pgvector.');
    console.log('   Next: Deploy to Vercel with `vercel --prod`');
}

main().catch(err => {
    console.error('\n❌ Migration failed:', err.message);
    process.exit(1);
}).finally(() => {
    prisma.$disconnect();
});
