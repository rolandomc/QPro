import React, { createContext, useContext, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Platform, Alert } from 'react-native';

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
      <Modal transparent animationType="fade" visible={state.visible} onRequestClose={close}>
        <View style={s.overlay}>
          <View style={s.box}>
            <Text style={s.title}>{state.title}</Text>
            {state.message ? <Text style={s.message}>{state.message}</Text> : null}
            <View style={[s.btnRow, state.buttons.length === 1 && s.btnRowSingle]}>
              {state.buttons.map((btn, i) => (
                <TouchableOpacity
                  key={i}
                  style={[s.btn, btn.style === 'cancel' ? s.btnCancel : s.btnConfirm]}
                  onPress={() => { close(); setTimeout(() => btn.onPress?.(), 100); }}
                >
                  <Text style={[s.btnTxt, btn.style === 'cancel' ? s.btnTxtCancel : s.btnTxtConfirm]}>
                    {btn.text}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </AlertContext.Provider>
  );
}

export function useAlert() {
  return useContext(AlertContext);
}

const s = StyleSheet.create({
  overlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 24 },
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
