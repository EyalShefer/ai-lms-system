import * as pdfjsLib from 'pdfjs-dist';

// תיקון קריטי: שימוש בשרת unpkg ובסיומת .mjs שמתאימה לגרסה החדשה
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

export async function extractTextFromPDF(file: File): Promise<string> {
    console.log("📖 מתחיל לקרוא את הקובץ:", file.name);

    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        let fullText = "";
        console.log(`הקובץ מכיל ${pdf.numPages} עמודים.`);

        // מעבר על כל העמודים בקובץ
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map((item: any) => item.str).join(' ');

            // הוספת סימון ברור של עמודים ל-AI
            fullText += `\n--- עמוד ${i} ---\n${pageText}`;
        }

        console.log(`✅ הקריאה הסתיימה בהצלחה! חולצו ${fullText.length} תווים.`);
        return fullText;

    } catch (error) {
        console.error("❌ שגיאה בקריאת ה-PDF:", error);
        throw new Error("לא הצלחנו לקרוא את קובץ ה-PDF. וודא שהוא תקין ולא מוגן בסיסמה.");
    }
}