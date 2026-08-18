import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Support large base64 image uploads from camera
  app.use(express.json({ limit: '30mb' }));
  app.use(express.urlencoded({ extended: true, limit: '30mb' }));

  // API Route: Health Check
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', serverTime: new Date().toISOString() });
  });

  // API Route: Gemini AI License Plate Recognition
  app.post('/api/ocr/gemini-plate', async (req: Request, res: Response): Promise<void> => {
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

      // Extract base64 data and mimeType
      let mimeType = 'image/jpeg';
      let base64Data = photoDataUrl;

      const matches = photoDataUrl.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        mimeType = matches[1];
        base64Data = matches[2];
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const prompt = `Analise esta foto do veículo e identifique com extrema precisão a placa brasileira (padrão Mercosul carro LLLNLNN ex: BRA2E19, Mercosul moto LLLNNLN ex: ABC12D3 ou padrão antigo LLLNNNN ex: ABC1234).
A placa pode estar em qualquer posição da imagem (para-choque dianteiro, traseiro, inclinada, no canto, com reflexos ou embaçada).
Retorne a placa limpa com 7 caracteres alfanuméricos em caixa alta sem traço ou espaços.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: {
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType,
              },
            },
            {
              text: prompt,
            },
          ],
        },
        config: {
          systemInstruction:
            'Você é um sistema especialista de visão computacional para detecção e leitura de placas de veículos brasileiras (Mercosul Carro, Mercosul Moto e Placa Antiga Cinza). Mesmo com iluminação difícil, ângulos laterais, sombras ou sujeira, examine a foto minuciosamente para extrair os 7 caracteres da placa.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              found: {
                type: Type.BOOLEAN,
                description: 'Verdadeiro se uma placa de veículo foi localizada na foto',
              },
              plate: {
                type: Type.STRING,
                description: 'Os 7 caracteres da placa brasileira sem traço nem espaços (ex: BRA2E19, ABC1D23, ABC1234, ABC12D3)',
              },
              isMercosul: {
                type: Type.BOOLEAN,
                description: 'Verdadeiro se a placa está no padrão Mercosul (possui letra na 5ª ou 6ª posição)',
              },
              confidence: {
                type: Type.NUMBER,
                description: 'Nível de confiança de 0 a 1',
              },
              details: {
                type: Type.STRING,
                description: 'Detalhes da localização ou veículo identificado',
              },
            },
            required: ['found', 'plate'],
          },
        },
      });

      const responseText = response.text?.trim() || '{}';
      let parsedData: any = {};

      try {
        parsedData = JSON.parse(responseText);
      } catch (parseErr) {
        console.warn('Error parsing Gemini JSON response:', responseText);
      }

      const cleanPlate = (parsedData.plate || '')
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 7);

      res.json({
        success: true,
        found: Boolean(parsedData.found && cleanPlate.length === 7),
        plate: cleanPlate,
        isMercosul: Boolean(parsedData.isMercosul),
        confidence: parsedData.confidence ?? 0.95,
        details: parsedData.details || '',
        rawAiResponse: responseText,
      });
    } catch (err: any) {
      console.error('Gemini Plate Recognition API Error:', err);
      res.status(500).json({
        success: false,
        error: err.message || 'Erro ao processar imagem com IA Gemini.',
      });
    }
  });

  // Vite middleware for development vs Static serving for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚗 Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
