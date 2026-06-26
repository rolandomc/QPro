/**
 * Parcha Alert.alert de React Native en web con un modal DOM puro.
 * Importar UNA vez en app/_layout.tsx — aplica globalmente.
 */
import { Platform, Alert } from 'react-native';

if (Platform.OS === 'web' && typeof document !== 'undefined') {
  // Estilos inyectados una sola vez
  const styleId = '__qpro_alert_style';
  if (!document.getElementById(styleId)) {
    const s = document.createElement('style');
    s.id = styleId;
    s.textContent = `
      #__qpro_alert_overlay {
        position: fixed; inset: 0; z-index: 999999;
        background: rgba(0,0,0,0.82);
        display: flex; align-items: center; justify-content: center;
        padding: 24px; box-sizing: border-box;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }
      #__qpro_alert_box {
        background: #15181F; border-radius: 18px; padding: 24px;
        width: 100%; max-width: 360px;
        border: 1px solid #2A2D35;
        display: flex; flex-direction: column; gap: 0;
      }
      #__qpro_alert_title {
        color: #FFF; font-size: 18px; font-weight: bold;
        margin: 0 0 10px; text-align: center;
      }
      #__qpro_alert_msg {
        color: #A0A0A0; font-size: 14px; line-height: 1.6;
        margin: 0 0 20px; text-align: center;
        white-space: pre-line;
      }
      #__qpro_alert_btns {
        display: flex; gap: 10px;
      }
      .__qpro_btn {
        flex: 1; padding: 13px; border-radius: 12px;
        border: 1px solid; font-weight: bold; font-size: 14px;
        cursor: pointer; font-family: inherit;
      }
      .__qpro_btn_cancel  { background: #1C1F26; border-color: #2A2D35; color: #A0A0A0; }
      .__qpro_btn_confirm { background: #2ECC71; border-color: #2ECC71; color: #000; }
      .__qpro_btn_danger  { background: #E74C3C; border-color: #E74C3C; color: #FFF; }
    `;
    document.head.appendChild(s);
  }

  function showDOMAlert(
    title: string,
    message?: string,
    buttons?: Array<{ text: string; style?: string; onPress?: () => void }>
  ) {
    // Elimina overlay anterior si existe
    document.getElementById('__qpro_alert_overlay')?.remove();

    const btns = buttons && buttons.length > 0
      ? buttons
      : [{ text: 'OK', style: 'default', onPress: undefined }];

    const overlay = document.createElement('div');
    overlay.id = '__qpro_alert_overlay';

    const box = document.createElement('div');
    box.id = '__qpro_alert_box';

    const titleEl = document.createElement('p');
    titleEl.id = '__qpro_alert_title';
    titleEl.textContent = title;
    box.appendChild(titleEl);

    if (message) {
      const msgEl = document.createElement('p');
      msgEl.id = '__qpro_alert_msg';
      msgEl.textContent = message;
      box.appendChild(msgEl);
    }

    const btnRow = document.createElement('div');
    btnRow.id = '__qpro_alert_btns';
    if (btns.length === 1) btnRow.style.justifyContent = 'center';

    btns.forEach(btn => {
      const b = document.createElement('button');
      b.className = '__qpro_btn';
      b.textContent = btn.text;
      if (btn.style === 'cancel') b.classList.add('__qpro_btn_cancel');
      else if (btn.style === 'destructive') b.classList.add('__qpro_btn_danger');
      else b.classList.add('__qpro_btn_confirm');

      b.onclick = () => {
        overlay.remove();
        setTimeout(() => btn.onPress?.(), 50);
      };
      btnRow.appendChild(b);
    });

    box.appendChild(btnRow);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  }

  // Parcha Alert directamente
  (Alert as any).alert = showDOMAlert;
}

export {};
