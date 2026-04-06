import fs from 'fs';
import { PDFParse } from 'pdf-parse'; // استيراد الـ Class الخاص بالنسخة 2
import mammoth from 'mammoth';

/**
 * Extracts text from a file based on its MIME type.
 * Supports PDF (v2), DOCX, and TXT.
 */
export async function extractText(filePath: string, mimeType: string): Promise<string> {
  const buffer = fs.readFileSync(filePath);

  try {
    if (mimeType === 'application/pdf') {
      // ✅ الطريقة الصحيحة لـ pdf-parse v2
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      return result.text;
    } 
    
    else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
             mimeType === 'application/msword') {
      // استخراج النص من Word
      const result = await mammoth.extractRawText({ buffer: buffer });
      return result.value;
    } 
    
    else if (mimeType === 'text/plain') {
      return buffer.toString('utf-8');
    } 
    
    else {
      throw new Error(`Unsupported file type: ${mimeType}`);
    }
  } catch (error) {
    throw new Error(`Failed to extract text from file: ${error}`);
  }
}