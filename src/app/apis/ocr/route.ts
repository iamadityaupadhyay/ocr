import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb', // Allow larger image uploads
    },
  },
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { base64Image } = body;

    if (!base64Image) {
      return NextResponse.json({ error: 'Image is required' }, { status: 400 });
    }

    // Validate base64 format
    if (!base64Image.startsWith('data:image/')) {
      return NextResponse.json({ error: 'Invalid image format' }, { status: 400 });
    }

    // Extract the actual base64 data (remove the data URL prefix)
    const base64Data = base64Image.replace(/^data:image\/[^;]+;base64,/, '');
    
    if (!base64Data || base64Data.length < 10) {
      return NextResponse.json({ error: 'Invalid base64 image data' }, { status: 400 });
    }

    // Determine the MIME type from the data URL

    const mimeTypeMatch = base64Image.match(/^data:(image\/[^;]+);base64,/);
    // weare sending image/jpeg as default if no MIME type is foundq

    const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : 'image/jpeg';

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const imagePart = {
      inlineData: {
        data: base64Data,
        mimeType: mimeType,
      },
    };

    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            { text: 'Extract all visible text from this image., translate to english only and give as it is formated ,give the output with 100% match' },
            imagePart,
          ],
        },
      ],
    });

    const text = result.response.text();
    return NextResponse.json({ text });
  } catch (error) {
    console.error('Gemini OCR error:', error);
    
    // Provide more specific error messages
    if (error instanceof Error && error.message.includes('Base64 decoding failed')) {
      return NextResponse.json({ error: 'Invalid image data format' }, { status: 400 });
    }
    
    return NextResponse.json({ error: 'Failed to extract text' }, { status: 500 });
  }
}
