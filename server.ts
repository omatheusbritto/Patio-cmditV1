import express, { Request, Response } from 'express';
import path from 'path';
import { GoogleGenAI, Type } from '@google/genai';
import { spawn } from 'child_process';
import dotenv from 'dotenv';

dotenv.config();

const rootDir = process.cwd();

// Priority order for ultra-fast, high-accuracy recognition
const FAST_VISION_MODELS = [
  'gemini-3.5-flash',
  'gemini-3.6-flash',
  'gemini-3.7-flash',
  'gemini-flash-latest',
];

/**
 * High-Speed Python License Plate Engine (via stdin/stdout)
 */
function executePythonEngine(photoDataUrl: string, apiKey: string): Promise<any> {
  return new Promise((resolve) => {
    try {
      const pythonProcess = spawn('python3', [
        path.join(rootDir, 'python_engine', 'plate_reader.py'),
      ]);

      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      pythonProcess.on('close', (code) => {
        if (code === 0 && stdout.trim()) {
          try {
            const parsed = JSON.parse(stdout.trim());
            resolve(parsed);
            return;
          } catch (e) {
            console.warn('Failed to parse Python engine output:', stdout);
          }
        }
        resolve({
          success: false,
          error: stderr || `Python process exited with code ${code}`,
        });
      });

      const inputPayload = JSON.stringify({ photoDataUrl, apiKey });
      pythonProcess.stdin.write(inputPayload);
      pythonProcess.stdin.end();
    } catch (err: any) {
      resolve({ success: false, error: err.message });
    }
  });
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Support large base64 image uploads from camera
  app.use(express.json({ limit: '35mb' }));
  app.use(express.urlencoded({ extended: true, limit: '35mb' }));

  // API Route: Health Check & Engine Status
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      engine: 'High-Speed Python 3.10 & Gemini 3.5 Flash Vision Engine',
      latencyTarget: '<500ms',
      serverTime: new Date().toISOString(),
    });
  });

  // API Route: Dedicated Python Engine Endpoint
  app.post('/api/ocr/python-plate', async (req: Request, res: Response): Promise<void> => {
    try {
      const { photoDataUrl } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        res.status(500).json({ success: false, error: 'API Key missing' });
        return;
      }
      const result = await executePythonEngine(photoDataUrl, apiKey);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // API Route: Ultra-Fast In-Memory Vision Core with Zero Hallucination
  app.post('/api/ocr/gemini-plate', async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    try {
      const { photoDataUrl } = req.body;

      if (!photoDataUrl || typeof photoDataUrl !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Foto não fornecida ou formato inválido.',
        });
        return;
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        res.status(500).json({
          success: false,
          error: 'Chave GEMINI_API_KEY não configurada no servidor.',
        });
        return;
      }

      // Fast base64 parser
      let mimeType = 'image/jpeg';
      let base64Data = photoDataUrl;

      const commaIdx = photoDataUrl.indexOf(',');
      if (commaIdx !== -1) {
        const header = photoDataUrl.substring(0, commaIdx);
        base64Data = photoDataUrl.substring(commaIdx + 1);
        const mimeMatch = header.match(/data:([^;]+);/);
        if (mimeMatch) mimeType = mimeMatch[1];
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      // Streamlined prompt optimized for sub-500ms token generation
      const systemInstruction = `Perito em identificação de placas veiculares brasileiras (Mercosul e Antiga).
REGRAS ESTRITAS DE ZERO ALUCINAÇÃO:
1. Extraia os 7 caracteres da chapa da placa do veículo. Se não houver placa visível ou for ilegível, found: false e plate: "".
2. Ignore marcas do carro, molduras e textos como BRASIL/MERCOSUL.
3. Formatos:
   - Mercosul Carro: LLLNLNN (Pos 1-3 Letras; Pos 4 Número; Pos 5 Letra; Pos 6-7 Números)
   - Mercosul Moto: LLLNNLN (Pos 1-3 Letras; Pos 4-5 Números; Pos 6 Letra; Pos 7 Número)
   - Placa Antiga: LLLNNNN (Pos 1-3 Letras; Pos 4-7 Números)
4. Coordenadas da placa no boundingBox [ymin, xmin, ymax, xmax] normalizadas de 0 a 1000.`;

      let lastError: any = null;

      // Try fast-path models sequentially
      for (const modelName of FAST_VISION_MODELS) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: [
              {
                inlineData: {
                  data: base64Data,
                  mimeType,
                },
              },
              {
                text: 'Leia a placa veicular brasileira desta imagem imediatamente.',
              },
            ],
            config: {
              systemInstruction,
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  found: { type: Type.BOOLEAN },
                  plate: { type: Type.STRING },
                  plateType: { type: Type.STRING },
                  boundingBox: {
                    type: Type.ARRAY,
                    items: { type: Type.INTEGER },
                  },
                  isCertain: { type: Type.BOOLEAN },
                  analysisNotes: { type: Type.STRING },
                },
                required: ['found', 'plate', 'isCertain'],
              },
              temperature: 0.0,
            },
          });

          const responseText = response.text?.trim() || '{}';
          let parsedData: any = {};

          try {
            parsedData = JSON.parse(responseText);
          } catch {
            console.warn('JSON parse warning:', responseText);
          }

          const rawPlate = (parsedData.plate || '')
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, '')
            .slice(0, 7);

          const isFound = Boolean(parsedData.found && rawPlate.length === 7);
          const elapsedMs = Date.now() - startTime;

          res.json({
            success: true,
            engine: 'high_speed_vision_engine',
            modelUsed: modelName,
            found: isFound,
            plate: rawPlate,
            plateType: parsedData.plateType || 'mercosul_car',
            boundingBox: parsedData.boundingBox || null,
            isCertain: Boolean(parsedData.isCertain),
            analysisNotes: parsedData.analysisNotes || `Lido em ${elapsedMs}ms via ${modelName}`,
            processingTimeMs: elapsedMs,
          });
          return;
        } catch (modelErr: any) {
          console.warn(`Model ${modelName} fast-path error:`, modelErr.message);
          lastError = modelErr;
        }
      }

      // If fast-path had temporary issues, fallback to Python engine
      const pyResult = await executePythonEngine(photoDataUrl, apiKey);
      if (pyResult && pyResult.success) {
        res.json({
          ...pyResult,
          processingTimeMs: Date.now() - startTime,
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: lastError?.message || 'Falha ao processar visão computacional.',
      });
    } catch (err: any) {
      console.error('Vision API Error:', err);
      res.status(500).json({
        success: false,
        error: err.message || 'Erro ao processar imagem.',
      });
    }
  });

  // Vite middleware for development vs Static serving for production
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(rootDir, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
