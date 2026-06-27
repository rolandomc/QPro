/**
 * Implementación WEB
 * Metro carga automáticamente este archivo en lugar de captureView.ts
 * cuando el target es web (resolución por sufijo de plataforma).
 */
import { toPng } from 'html-to-image';
import type { RefObject } from 'react';
import type { View } from 'react-native';

export async function captureView(ref: RefObject<View | null>): Promise<string> {
  // En React Native Web, ref.current es el HTMLElement real
  const node = ref.current as unknown as HTMLElement;
  if (!node) throw new Error('ref no disponible');
  return toPng(node, { pixelRatio: 2 });
}
