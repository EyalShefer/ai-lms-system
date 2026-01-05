/**
 * HTML to Image Converter
 * Converts HTML/CSS/SVG code to PNG image using html2canvas
 * Optimized for Hebrew RTL content and educational infographics
 */

import html2canvas from 'html2canvas';

export interface ConversionOptions {
  width?: number;
  height?: number;
  scale?: number;
  backgroundColor?: string;
}

/**
 * Convert HTML string to PNG Blob
 * @param htmlContent - Complete HTML document string
 * @param options - Conversion options
 * @returns Promise<Blob | null> - PNG image blob or null on failure
 */
export const convertHTMLToImage = async (
  htmlContent: string,
  options: ConversionOptions = {}
): Promise<Blob | null> => {
  const {
    width = 1024,
    height = 1024,
    scale = 2, // High quality (2x resolution)
    backgroundColor = '#ffffff'
  } = options;

  try {
    console.log('🖼️ Converting HTML to image...');

    // Create temporary container
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.top = '-9999px'; // Hide off-screen
    container.style.left = '-9999px';
    container.style.width = `${width}px`;
    container.style.height = `${height}px`;
    container.style.overflow = 'hidden';

    // Insert HTML content
    container.innerHTML = htmlContent;

    document.body.appendChild(container);

    // Wait for fonts and images to load
    await document.fonts.ready;

    // Small delay for rendering
    await new Promise(resolve => setTimeout(resolve, 100));

    // Capture screenshot with html2canvas
    const canvas = await html2canvas(container, {
      width,
      height,
      scale,
      backgroundColor,
      logging: false,
      useCORS: true,
      allowTaint: true,
      // RTL support
      scrollX: 0,
      scrollY: 0,
      windowWidth: width,
      windowHeight: height
    });

    // Cleanup - remove container
    document.body.removeChild(container);

    // Convert canvas to Blob
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) {
          console.log(`✅ Image generated: ${(blob.size / 1024).toFixed(2)} KB`);
          resolve(blob);
        } else {
          console.error('❌ Canvas to Blob conversion failed');
          resolve(null);
        }
      }, 'image/png', 1.0);
    });

  } catch (error) {
    console.error('❌ HTML to Image conversion failed:', error);
    return null;
  }
};

/**
 * Preview HTML in new window (for debugging)
 */
export const previewHTML = (htmlContent: string): void => {
  const newWindow = window.open('', '_blank');
  if (newWindow) {
    newWindow.document.write(htmlContent);
    newWindow.document.close();
  }
};
