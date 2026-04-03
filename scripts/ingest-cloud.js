/**
 * ingest-cloud.js
 * Migrates local data/vector_store.json → Qdrant Cloud
 * Run once: node scripts/ingest-cloud.js
 */

const fs = require('fs');
const path = require('path');

const QDRANT_URL = process.env.QDRANT_URL || 'https://05a732e7-a7d7-4519-86fd-92544b3248a4.us-east4-0.gcp.cloud.qdrant.io:6333';
const QDRANT_API_KEY = process.env.QDRANT_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3MiOiJtIn0.wPOvPNHdLudG-ko_BI75r-kYaSSsJ41aGJRzq32E39U';

const COLLECTION_NAME = 'garuda_scriptures';
const VECTOR_DIM = 768;
const BATCH_SIZE = 100; // Upload 100 vectors at a time

const VECTOR_STORE_PATH = path.join(process.cwd(), 'data', 'vector_store.json');

// ── Qdrant REST helpers ────────────────────────────────────────
async function qdrantRequest(method, endpoint, body) {
    const res = await fetch(`${QDRANT_URL}${endpoint}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            'api-key': QDRANT_API_KEY,
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Qdrant ${method} ${endpoint} → ${res.status}: ${txt}`);
    }
    return res.json();
}

async function main() {
    console.log('🚀 Garuda Cloud Ingest — Migrating to Qdrant...\n');

    // 1. Load the local vector store
    if (!fs.existsSync(VECTOR_STORE_PATH)) {
        console.error('❌ data/vector_store.json not found. Run `npm run ingest` first.');
        process.exit(1);
    }
    console.log('📂 Loading local vector store...');
    const vectors = JSON.parse(fs.readFileSync(VECTOR_STORE_PATH, 'utf8'));
    console.log(`✅ Loaded ${vectors.length} chunks.\n`);

    // 2. Create/recreate the Qdrant collection
    console.log(`🏗️  Creating Qdrant collection "${COLLECTION_NAME}"...`);
    try {
        // Try to delete existing collection (clean slate)
        await qdrantRequest('DELETE', `/collections/${COLLECTION_NAME}`);
        console.log('   (Deleted existing collection for clean upload)');
    } catch (_) { /* Collection didn't exist yet — that's fine */ }

    await qdrantRequest('PUT', `/collections/${COLLECTION_NAME}`, {
        vectors: {
            size: VECTOR_DIM,
            distance: 'Cosine',
        },
    });
    console.log(`✅ Collection created.\n`);

    // 3. Upload in batches
    const totalBatches = Math.ceil(vectors.length / BATCH_SIZE);
    console.log(`📤 Uploading ${vectors.length} vectors in ${totalBatches} batches of ${BATCH_SIZE}...`);

    for (let i = 0; i < vectors.length; i += BATCH_SIZE) {
        const batch = vectors.slice(i, i + BATCH_SIZE);
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;

        const points = batch.map((v, idx) => ({
            id: i + idx,
            vector: v.embedding,
            payload: {
                text: v.text,
                source: v.source,
                chunk_index: v.chunk_index,
            },
        }));

        await qdrantRequest('PUT', `/collections/${COLLECTION_NAME}/points`, {
            points,
        });

        process.stdout.write(`\r   Batch ${batchNum}/${totalBatches} uploaded (${Math.min(i + BATCH_SIZE, vectors.length)}/${vectors.length} vectors)`);
    }

    console.log('\n');

    // 4. Verify
    const info = await qdrantRequest('GET', `/collections/${COLLECTION_NAME}`);
    const count = info?.result?.vectors_count ?? '?';
    console.log(`✅ Qdrant reports ${count} vectors stored.`);
    console.log('\n🎉 Migration complete! Garuda AI is now cloud-powered.');
    console.log('   Next: Deploy to Vercel with `vercel --prod`');
}

main().catch(err => {
    console.error('\n❌ Migration failed:', err.message);
    process.exit(1);
});
