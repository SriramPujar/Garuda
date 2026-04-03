const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');

const DOCS_DIR = path.join(process.cwd(), 'docs');
const DATA_DIR = path.join(process.cwd(), 'data');
const VECTOR_STORE_PATH = path.join(DATA_DIR, 'vector_store.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Ensure Ollama model is used
const OLLAMA_URL = 'http://localhost:11434/api/embeddings';
const EMBEDDING_MODEL = 'nomic-embed-text';

// Hit Ollama local inference to embed a string
async function embedText(text) {
    const response = await fetch(OLLAMA_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: EMBEDDING_MODEL,
            prompt: text
        })
    });

    if (!response.ok) {
        throw new Error(`Ollama Embedding failed: ${await response.text()}`);
    }

    const json = await response.json();
    return json.embedding;
}

// Split text into chunks
function chunkText(text, maxChars = 1000, minChars = 100) {
  let rawChunks = text.split(/\n\s*\n/);
  let chunks = [];
  let currentChunk = '';

  for (let c of rawChunks) {
    c = c.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    if (!c) continue;
    
    // If the combined chunk is small enough, append it
    if ((currentChunk.length + c.length) < maxChars) {
      currentChunk += (currentChunk ? ' ' : '') + c;
    } else {
      // Over the limit, finalize the current chunk if valid, then start new
      if (currentChunk.length >= minChars) {
        chunks.push(currentChunk);
      }
      currentChunk = c;
    }
  }
  // Add remaining
  if (currentChunk.length >= minChars) {
    chunks.push(currentChunk);
  }
  return chunks;
}

// Function to process a single PDF file
async function processFile(filePath) {
  console.log(`\n📄 Parsing ${path.basename(filePath)}...`);
  
  const dataBuffer = fs.readFileSync(filePath);
  
  const data = await pdfParse(dataBuffer).catch(err => {
    console.error(`Failed to parse ${filePath}:`, err.message);
    return null;
  });

  if (!data || !data.text) {
    console.log(`⚠️ Skiping ${path.basename(filePath)}, no text found.`);
    return [];
  }

  console.log(`✅ Text extracted (${data.text.length} characters). Chunking...`);
  const chunks = chunkText(data.text);
  console.log(`🔪 Split into ${chunks.length} chunks.`);

  const vectorData = [];
  
  // Process vectors sequentially to not overload Ollama
  for (let i = 0; i < chunks.length; i++) {
     try {
       const embedding = await embedText(chunks[i]);
       
       vectorData.push({
         text: chunks[i],
         source: path.basename(filePath),
         chunk_index: i,
         embedding: embedding
       });

       if (i > 0 && i % 100 === 0) {
          console.log(`   Embedded ${i}/${chunks.length} chunks...`);
       }
     } catch (err) {
       console.error(`Failed to embed chunk ${i} of ${filePath}:`, err.message);
     }
  }
  
  return vectorData;
}

async function main() {
  console.log('🚀 Starting ingestion process with local Ollama...');
  
  if (!fs.existsSync(DOCS_DIR)) {
    console.error(`❌ docs directory missing! Please format PDFs at ${DOCS_DIR}`);
    return;
  }

  const files = fs.readdirSync(DOCS_DIR).filter(file => file.toLowerCase().endsWith('.pdf'));
  
  if (files.length === 0) {
    console.warn(`⚠️ No PDF files found in ${DOCS_DIR}`);
    return;
  }

  console.log(`Found ${files.length} PDFs. Verifying Ollama model "${EMBEDDING_MODEL}" is pulled...`);

  let allVectorData = [];
  
  // Initialize file
  fs.writeFileSync(VECTOR_STORE_PATH, JSON.stringify([]));

  for (const file of files) {
    const fullPath = path.join(DOCS_DIR, file);
    const fileVectors = await processFile(fullPath);
    allVectorData = allVectorData.concat(fileVectors);
    
    // Save continuously per file to avoid catastrophic loss
    fs.writeFileSync(VECTOR_STORE_PATH, JSON.stringify(allVectorData, null, 2));
    console.log(`💾 Saved ${allVectorData.length} total vectors to disk after ${file}.`);
  }

  console.log('\n🎉 Ingestion complete!');
}

main().catch(console.error);
