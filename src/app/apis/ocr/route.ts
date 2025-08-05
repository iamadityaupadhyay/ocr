

import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Configure rate limiting
const RATE_LIMIT = {
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Max requests per window
};

const requestCounts = new Map<string, number>();

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
  runtime: 'edge', // Consider using edge runtime for better performance
};

export async function POST(req: NextRequest) {
  try {
    // Simple rate limiting
    const ip = req.ip || req.headers.get('x-forwarded-for') || 'unknown';
    const count = (requestCounts.get(ip) || 0) + 1;
    requestCounts.set(ip, count);
    
    if (count > RATE_LIMIT.max) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { base64Image } = body;

    if (!base64Image) {
      return NextResponse.json(
        { error: 'Image is required' }, 
        { status: 400 }
      );
    }

    // Enhanced base64 validation
    const base64Regex = /^data:image\/(png|jpeg|jpg|gif|webp);base64,[a-zA-Z0-9+/]+={0,2}$/;
    if (!base64Regex.test(base64Image)) {
      return NextResponse.json(
        { error: 'Invalid image format. Supported formats: PNG, JPEG, JPG, GIF, WEBP' },
        { status: 400 }
      );
    }

    // Extract data and MIME type more reliably
    const [mimeType, base64Data] = base64Image.split(';base64,');
    if (!mimeType || !base64Data) {
      return NextResponse.json(
        { error: 'Invalid base64 image data' },
        { status: 400 }
      );
    }

    // Validate base64 length
    if (base64Data.length < 1000) {
      return NextResponse.json(
        { error: 'Image data too small. Please upload a higher quality image.' },
        { status: 400 }
      );
    }

    // Initialize model with timeout
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash', // Updated to newer model
      generationConfig: {
        maxOutputTokens: 4000,
      },
    });

    // Enhanced prompt with fallback instructions
    const prompt = `
      Extract all visible text from this image exactly as it appears, including:
      - All characters, numbers, and symbols
      - Preserve original formatting, spacing, and line breaks
      - Do not correct spelling or grammar
      - If text is in another language, translate to English while preserving formatting
      - If no text is found, respond with "[NO_TEXT_FOUND]"
      
      Output must be 100% accurate to the original image content.
    `;

    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [
          { text: prompt },
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType.replace('data:', ''),
            },
          },
        ],
      }],
    });

    const text = result.response.text().trim();
    
    if (!text || text === '[NO_TEXT_FOUND]') {
      return NextResponse.json(
        { error: 'No text could be extracted from the image' },
        { status: 400 }
      );
    }

    return NextResponse.json({ text });
  } catch (error) {
    console.error('Gemini OCR error:', error);
    
    // Enhanced error handling
    let errorMessage = 'Failed to extract text';
    let statusCode = 500;

    if (error instanceof Error) {
      if (error.message.includes('invalid base64')) {
        errorMessage = 'Invalid image data format';
        statusCode = 400;
      } else if (error.message.includes('content policy')) {
        errorMessage = 'Image violates content policy';
        statusCode = 400;
      } else if (error.message.includes('timeout')) {
        errorMessage = 'Processing timeout. Please try a smaller image.';
        statusCode = 408;
      }
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  }
}
