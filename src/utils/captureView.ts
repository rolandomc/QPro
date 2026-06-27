/**
 * Implementación NATIVA (iOS / Android)
 * Metro usa este archivo en plataformas no-web.
 */
import { captureRef } from 'react-native-view-shot';
import type { RefObject } from 'react';
import type { View } from 'react-native';

export async function captureView(ref: RefObject<View | null>): Promise<string> {
  return captureRef(ref as any, { format: 'png', quality: 1, result: 'tmpfile' });
}
