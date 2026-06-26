import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';

export type WebAlertButton = {
  text: string;
  style?: 'cancel' | 'default' | 'destructive';
  onPress?: () => void;
};

type Props = {
  visible: boolean;
  title: string;
  message?: string;
  buttons?: WebAlertButton[];
  onClose: () => void;
};

export function WebAlert({ visible, title, message, buttons = [], onClose }: Props) {
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.box}>
          <Text style={s.title}>{title}</Text>
          {message ? <Text style={s.message}>{message}</Text> : null}
          <View style={s.btnRow}>
            {buttons.map((btn, i) => (
              <TouchableOpacity
                key={i}
                style={[s.btn, btn.style === 'cancel' ? s.btnCancel : s.btnConfirm]}
                onPress={() => { onClose(); btn.onPress?.(); }}
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
  );
}

// Helper igual a Alert.alert para reemplazarlo facilmente
let _setAlert: ((cfg: Omit<Props, 'onClose'> & { onClose?: () => void }) => void) | null = null;

export function registerAlertSetter(fn: typeof _setAlert) {
  _setAlert = fn;
}

export function showAlert(
  title: string,
  message?: string,
  buttons?: WebAlertButton[]
) {
  if (Platform.OS !== 'web') {
    // En nativo usa Alert normal
    const { Alert } = require('react-native');
    Alert.alert(title, message, buttons);
    return;
  }
  _setAlert?.({ visible: true, title, message, buttons });
}

const s = StyleSheet.create({
  overlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 30 },
  box:          { backgroundColor: '#15181F', borderRadius: 18, padding: 24, width: '100%', maxWidth: 360, borderWidth: 1, borderColor: '#2A2D35' },
  title:        { color: '#FFF', fontSize: 18, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' },
  message:      { color: '#A0A0A0', fontSize: 14, lineHeight: 22, marginBottom: 20, textAlign: 'center' },
  btnRow:       { flexDirection: 'row', gap: 10, justifyContent: 'center' },
  btn:          { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center', borderWidth: 1 },
  btnCancel:    { backgroundColor: '#1C1F26', borderColor: '#2A2D35' },
  btnConfirm:   { backgroundColor: '#2ECC71', borderColor: '#2ECC71' },
  btnTxt:       { fontWeight: 'bold', fontSize: 14 },
  btnTxtCancel: { color: '#A0A0A0' },
  btnTxtConfirm:{ color: '#000' },
});
