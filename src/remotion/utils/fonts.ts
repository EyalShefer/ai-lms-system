/**
 * Font Configuration for Remotion
 * Hebrew RTL font support with Rubik
 */

import { staticFile, continueRender, delayRender } from 'remotion';

// Font family definitions
export const fonts = {
  primary: '"Rubik", "Heebo", sans-serif',
  mono: '"Fira Code", "Monaco", monospace',
  math: '"KaTeX_Main", "Times New Roman", serif',
} as const;

// Font weights
export const fontWeights = {
  light: 300,
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  extrabold: 800,
} as const;

/**
 * Load Google Fonts for Remotion
 * Call this at the start of your composition
 */
export const loadFonts = async (): Promise<void> => {
  const handle = delayRender('Loading fonts');

  try {
    // Load Rubik font (Hebrew support)
    const rubikFont = new FontFace(
      'Rubik',
      'url(https://fonts.gstatic.com/s/rubik/v28/iJWZBXyIfDnIV5PNhY1KTN7Z-Yh-B4i1UA.woff2)',
      {
        weight: '400',
        style: 'normal',
      }
    );

    const rubikBold = new FontFace(
      'Rubik',
      'url(https://fonts.gstatic.com/s/rubik/v28/iJWZBXyIfDnIV5PNhY1KTN7Z-Yh-NYi1UA.woff2)',
      {
        weight: '700',
        style: 'normal',
      }
    );

    await Promise.all([rubikFont.load(), rubikBold.load()]);
    document.fonts.add(rubikFont);
    document.fonts.add(rubikBold);

    continueRender(handle);
  } catch (error) {
    console.error('Failed to load fonts:', error);
    continueRender(handle);
  }
};

/**
 * Get font style for Hebrew RTL text
 */
export const getHebrewTextStyle = (
  weight: keyof typeof fontWeights = 'regular'
): React.CSSProperties => ({
  fontFamily: fonts.primary,
  fontWeight: fontWeights[weight],
  direction: 'rtl',
  textAlign: 'right',
  unicodeBidi: 'bidi-override',
});

/**
 * Get font style for math formulas
 */
export const getMathStyle = (): React.CSSProperties => ({
  fontFamily: fonts.math,
  fontWeight: fontWeights.regular,
});

export default fonts;
