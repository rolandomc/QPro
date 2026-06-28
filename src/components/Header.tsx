import React, { useState } from 'react';
import {
  StyleSheet, Text, View, Pressable,
  Modal, TouchableOpacity, TouchableWithoutFeedback,
} from 'react-native';
import { useRouter } from 'expo-router';

export type Deporte = 'futbol' | 'beisbol' | 'basquet';

const DEPORTES: { key: Deporte; label: string; emoji: string; proximamente?: boolean }[] = [
  { key: 'futbol',  label: 'Fútbol',    emoji: '⚽' },
  { key: 'beisbol', label: 'Béisbol',   emoji: '⚾', proximamente: true },
  { key: 'basquet', label: 'Básquetbol',emoji: '🏀', proximamente: true },
];

interface Props {
  deporteActivo: Deporte;
  onDeporteChange: (d: Deporte) => void;
}

export default function Header({ deporteActivo, onDeporteChange }: Props) {
  const router = useRouter();
  const [menuVisible, setMenuVisible] = useState(false);

  const deporteLabel = DEPORTES.find(d => d.key === deporteActivo);

  return (
    <View style={styles.header}>
      {/* Logo + dropdown */}
      <Pressable style={styles.logoRow} onPress={() => setMenuVisible(true)}>
        <Text style={styles.headerTitle}>
          <Text style={styles.neonTextGreen}>Q</Text>
          <Text style={styles.logoWhite}>Pro</Text>
        </Text>
        <View style={styles.deportePill}>
          <Text style={styles.deportePillText}>
            {deporteLabel?.emoji} {deporteLabel?.label}
          </Text>
          <Text style={styles.chevron}>▾</Text>
        </View>
      </Pressable>

      {/* Balance */}
      <Pressable style={styles.balanceButton} onPress={() => router.push('/wallet')}>
        <Text style={styles.balanceText}>$1,250.00</Text>
      </Pressable>

      {/* Dropdown modal */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setMenuVisible(false)}>
          <View style={styles.overlay}>
            <TouchableWithoutFeedback>
              <View style={styles.dropdown}>
                <Text style={styles.dropdownTitle}>Seleccionar deporte</Text>
                {DEPORTES.map((d) => (
                  <TouchableOpacity
                    key={d.key}
                    style={[
                      styles.dropdownItem,
                      deporteActivo === d.key && styles.dropdownItemActive,
                      d.proximamente && styles.dropdownItemDisabled,
                    ]}
                    onPress={() => {
                      if (!d.proximamente) {
                        onDeporteChange(d.key);
                        setMenuVisible(false);
                      }
                    }}
                    activeOpacity={d.proximamente ? 1 : 0.7}
                  >
                    <Text style={styles.dropdownEmoji}>{d.emoji}</Text>
                    <Text style={[
                      styles.dropdownLabel,
                      deporteActivo === d.key && styles.dropdownLabelActive,
                      d.proximamente && styles.dropdownLabelDisabled,
                    ]}>
                      {d.label}
                    </Text>
                    {d.proximamente && (
                      <View style={styles.proximamenteBadge}>
                        <Text style={styles.proximamenteText}>Próximamente</Text>
                      </View>
                    )}
                    {deporteActivo === d.key && !d.proximamente && (
                      <Text style={styles.checkmark}>✓</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  neonTextGreen: {
    color: '#2ECC71',
    fontWeight: 'bold',
    textShadowColor: 'rgba(46, 204, 113, 0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  logoWhite: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  deportePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1F26',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#2A2D35',
    gap: 4,
  },
  deportePillText: {
    color: '#E0E0E0',
    fontSize: 13,
    fontWeight: '600',
  },
  chevron: {
    color: '#A0A0A0',
    fontSize: 11,
  },
  balanceButton: {
    backgroundColor: '#1C1F26',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2ECC71',
  },
  balanceText: {
    color: '#2ECC71',
    fontWeight: 'bold',
    fontSize: 13,
  },
  // Modal / Dropdown
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-start',
    paddingTop: 90,
    paddingHorizontal: 20,
  },
  dropdown: {
    backgroundColor: '#15181F',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2A2D35',
    paddingVertical: 8,
    overflow: 'hidden',
  },
  dropdownTitle: {
    color: '#606060',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2D35',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E2028',
  },
  dropdownItemActive: {
    backgroundColor: 'rgba(46,204,113,0.08)',
  },
  dropdownItemDisabled: {
    opacity: 0.5,
  },
  dropdownEmoji: {
    fontSize: 20,
  },
  dropdownLabel: {
    color: '#E0E0E0',
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  dropdownLabelActive: {
    color: '#2ECC71',
  },
  dropdownLabelDisabled: {
    color: '#606060',
  },
  proximamenteBadge: {
    backgroundColor: 'rgba(243,156,18,0.15)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#F39C12',
  },
  proximamenteText: {
    color: '#F39C12',
    fontSize: 10,
    fontWeight: '700',
  },
  checkmark: {
    color: '#2ECC71',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
