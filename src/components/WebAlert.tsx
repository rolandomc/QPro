import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Platform, Alert, View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export type WebAlertButton = {
  text: string;
  style?: 'cancel' | 'default' | 'destructive';
  onPress?: () => void;
};

type AlertState = {
  visible: boolean;
  title: string;
  message?: string;
  buttons: WebAlertButton[];
};

type AlertContextType = {
  show: (title: string, message?: string, buttons?: WebAlertButton[]) => void;
};

const AlertContext = createContext<AlertContextType>({ show: () => {} });

// Modal nativo para iOS/Android
function NativeAlertModal({ state, onClose }: { state: AlertState; onClose: () => void }) {
  if (!state.visible) return null;
  return (
    <View style={ns.overlay}>
      <View style={ns.box}>
        <Text style={ns.title}>{state.title}</Text>
        {state.message ? <Text style={ns.message}>{state.message}</Text> : null}
        <View style={[ns.btnRow, state.buttons.length === 1 && ns.btnRowSingle]}>
          {state.buttons.map((btn, i) => (
            <TouchableOpacity
              key={i}
              style={[ns.btn, btn.style === 'cancel' ? ns.btnCancel : ns.btnConfirm]}
              onPress={() => { onClose(); setTimeout(() => btn.onPress?.(), 100); }}
            >
              <Text style={[ns.btnTxt, btn.style === 'cancel' ? ns.btnTxtCancel : ns.btnTxtConfirm]}>
                {btn.text}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

const ns = StyleSheet.create({
  overlay:       { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 24, zIndex: 99999 },
  box:           { backgroundColor: '#15181F', borderRadius: 18, padding: 24, width: '100%', maxWidth: 360, borderWidth: 1, borderColor: '#2A2D35' },
  title:         { color: '#FFF', fontSize: 18, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' },
  message:       { color: '#A0A0A0', fontSize: 14, lineHeight: 22, marginBottom: 20, textAlign: 'center' },
  btnRow:        { flexDirection: 'row', gap: 10 },
  btnRowSingle:  { justifyContent: 'center' },
  btn:           { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center', borderWidth: 1 },
  btnCancel:     { backgroundColor: '#1C1F26', borderColor: '#2A2D35' },
  btnConfirm:    { backgroundColor: '#2ECC71', borderColor: '#2ECC71' },
  btnTxt:        { fontWeight: 'bold', fontSize: 14 },
  btnTxtCancel:  { color: '#A0A0A0' },
  btnTxtConfirm: { color: '#000' },
});

// Portal DOM para web — inyecta un div encima de todo
function WebAlertPortal({ state, onClose }: { state: AlertState; onClose: () => void }) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const div = document.createElement('div');
    div.id = 'qpro-alert-portal';
    div.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:999999',
      'display:flex', 'align-items:center', 'justify-content:center',
      'background:rgba(0,0,0,0.82)', 'padding:24px',
    ].join(';');
    document.body.appendChild(div);
    containerRef.current = div;
    return () => { div.remove(); };
  }, []);

  useEffect(() => {
    const div = containerRef.current;
    if (!div) return;

    if (!state.visible) { div.style.display = 'none'; return; }
    div.style.display = 'flex';

    const btns = state.buttons.map(btn => {
      const b = document.createElement('button');
      b.textContent = btn.text;
      const isCancel = btn.style === 'cancel';
      b.style.cssText = [
        'flex:1', 'padding:13px', 'border-radius:12px',
        'border:1px solid', 'font-weight:bold', 'font-size:14px',
        'cursor:pointer', 'font-family:inherit',
        isCancel
          ? 'background:#1C1F26;border-color:#2A2D35;color:#A0A0A0'
          : 'background:#2ECC71;border-color:#2ECC71;color:#000',
      ].join(';');
      b.onclick = () => { onClose(); setTimeout(() => btn.onPress?.(), 100); };
      return b;
    });

    div.innerHTML = '';
    const box = document.createElement('div');
    box.style.cssText = [
      'background:#15181F', 'border-radius:18px', 'padding:24px',
      'width:100%', 'max-width:360px', 'border:1px solid #2A2D35',
      'display:flex', 'flex-direction:column', 'gap:0',
    ].join(';');

    const titleEl = document.createElement('p');
    titleEl.textContent = state.title;
    titleEl.style.cssText = 'color:#FFF;font-size:18px;font-weight:bold;margin:0 0 10px;text-align:center;font-family:inherit';
    box.appendChild(titleEl);

    if (state.message) {
      const msgEl = document.createElement('p');
      msgEl.textContent = state.message;
      msgEl.style.cssText = 'color:#A0A0A0;font-size:14px;line-height:1.6;margin:0 0 20px;text-align:center;white-space:pre-line;font-family:inherit';
      box.appendChild(msgEl);
    }

    const row = document.createElement('div');
    row.style.cssText = `display:flex;gap:10px;${state.buttons.length === 1 ? 'justify-content:center' : ''}`;
    btns.forEach(b => row.appendChild(b));
    box.appendChild(row);
    div.appendChild(box);
  }, [state]);

  return null;
}

export function AlertProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AlertState>({
    visible: false, title: '', message: '', buttons: []
  });

  const show = (title: string, message?: string, buttons?: WebAlertButton[]) => {
    if (Platform.OS !== 'web') {
      Alert.alert(title, message, buttons as any);
      return;
    }
    setState({ visible: true, title, message, buttons: buttons ?? [{ text: 'OK' }] });
  };

  const close = () => setState(prev => ({ ...prev, visible: false }));

  return (
    <AlertContext.Provider value={{ show }}>
      {children}
      {Platform.OS === 'web'
        ? <WebAlertPortal state={state} onClose={close} />
        : <NativeAlertModal state={state} onClose={close} />}
    </AlertContext.Provider>
  );
}

export function useAlert() {
  return useContext(AlertContext);
}
