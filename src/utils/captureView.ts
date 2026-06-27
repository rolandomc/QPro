import { Platform } from 'react-native';

/**
 * Captura un View/elemento como PNG y devuelve una URI.
 * - Nativo: usa captureRef de react-native-view-shot
 * - Web: usa html-to-image sobre el nodo DOM real
 */
export async function captureView(ref: React.RefObject<any>): Promise<string> {
  if (Platform.OS !== 'web') {
    const { captureRef } = await import('react-native-view-shot');
    return captureRef(ref, { format: 'png', quality: 1, result: 'tmpfile' });
  }

  // Web: obtenemos el nodo DOM desde el ref de React Native Web
  // RN Web expone el nodo real en ref.current (es un HTMLElement)
  const node: HTMLElement | null = ref.current;
  if (!node) throw new Error('ref no disponible');

  const { toPng } = await import('html-to-image');
  const dataUrl = await toPng(node, { pixelRatio: 2 });
  return dataUrl; // data:image/png;base64,...
}
