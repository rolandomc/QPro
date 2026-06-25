import React, { useRef, useEffect, useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, ScrollView,
  StyleSheet, Dimensions,
} from 'react-native';

const ITEM_H = 48;
const VISIBLE = 5;
const PAD = Math.floor(VISIBLE / 2);
const { width: SW } = Dimensions.get('window');

function pad(n: number) { return String(n).padStart(2, '0'); }

function WheelColumn({
  items, selectedIndex, onChange, width,
}: { items: string[]; selectedIndex: number; onChange: (i: number) => void; width: number }) {
  const ref = useRef<ScrollView>(null);
  const paddedItems = [
    ...Array(PAD).fill(''),
    ...items,
    ...Array(PAD).fill(''),
  ];

  useEffect(() => {
    ref.current?.scrollTo({ y: selectedIndex * ITEM_H, animated: false });
  }, [selectedIndex]);

  const onScroll = (e: any) => {
    const y   = e.nativeEvent.contentOffset.y;
    const idx = Math.round(y / ITEM_H);
    const clamped = Math.max(0, Math.min(items.length - 1, idx));
    if (clamped !== selectedIndex) onChange(clamped);
  };

  return (
    <View style={[wh.col, { width }]}>
      {/* Highlight del item seleccionado */}
      <View pointerEvents="none" style={wh.highlight} />
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        onMomentumScrollEnd={onScroll}
        onScrollEndDrag={onScroll}
        contentContainerStyle={{ paddingVertical: 0 }}
      >
        {paddedItems.map((item, i) => {
          const realIdx = i - PAD;
          const isSelected = realIdx === selectedIndex;
          return (
            <View key={i} style={wh.item}>
              <Text style={[wh.itemText, isSelected && wh.itemTextSelected]}>
                {item}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

export interface DateTimePickerProps {
  visible: boolean;
  initialDate?: Date;
  onConfirm: (date: Date) => void;
  onCancel: () => void;
}

export default function DateTimePicker({ visible, initialDate, onConfirm, onCancel }: DateTimePickerProps) {
  const now = initialDate ?? new Date();

  // Arrays de opciones
  const years   = Array.from({ length: 5 },  (_, i) => String(now.getFullYear() + i));
  const months  = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const hours   = Array.from({ length: 24 }, (_, i) => pad(i));
  const minutes = Array.from({ length: 60 }, (_, i) => pad(i));

  const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

  const [yearIdx,  setYearIdx]  = useState(0);
  const [monthIdx, setMonthIdx] = useState(now.getMonth());
  const [dayIdx,   setDayIdx]   = useState(now.getDate() - 1);
  const [hourIdx,  setHourIdx]  = useState(now.getHours());
  const [minIdx,   setMinIdx]   = useState(now.getMinutes());

  const selectedYear  = parseInt(years[yearIdx]);
  const daysCount     = getDaysInMonth(selectedYear, monthIdx);
  const days          = Array.from({ length: daysCount }, (_, i) => pad(i + 1));
  const safeDayIdx    = Math.min(dayIdx, daysCount - 1);

  const handleConfirm = () => {
    const d = new Date(
      selectedYear,
      monthIdx,
      safeDayIdx + 1,
      hourIdx,
      minIdx,
      0,
    );
    onConfirm(d);
  };

  // Ancho de cada columna
  const colDay   = 52;
  const colMonth = 64;
  const colYear  = 72;
  const colHour  = 52;
  const colMin   = 52;
  const sepW     = 16;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={wh.overlay}>
        <View style={wh.sheet}>
          <Text style={wh.title}>\uD83D\uDCC5 Fecha y hora</Text>

          {/* Etiquetas */}
          <View style={wh.labelsRow}>
            <Text style={[wh.colLabel, { width: colDay }]}>D\u00EDa</Text>
            <Text style={[wh.colLabel, { width: colMonth }]}>Mes</Text>
            <Text style={[wh.colLabel, { width: colYear }]}>A\u00F1o</Text>
            <View style={{ width: sepW }} />
            <Text style={[wh.colLabel, { width: colHour }]}>Hora</Text>
            <Text style={[wh.colLabel, { width: 14 }]} />
            <Text style={[wh.colLabel, { width: colMin }]}>Min</Text>
          </View>

          {/* Ruedas */}
          <View style={wh.wheels}>
            <WheelColumn items={days}   selectedIndex={safeDayIdx} onChange={setDayIdx}   width={colDay} />
            <WheelColumn items={months} selectedIndex={monthIdx}   onChange={setMonthIdx} width={colMonth} />
            <WheelColumn items={years}  selectedIndex={yearIdx}    onChange={setYearIdx}  width={colYear} />
            <View style={wh.separator}><Text style={wh.separatorText}>/</Text></View>
            <WheelColumn items={hours}  selectedIndex={hourIdx}    onChange={setHourIdx}  width={colHour} />
            <View style={wh.separator}><Text style={wh.separatorText}>:</Text></View>
            <WheelColumn items={minutes} selectedIndex={minIdx}    onChange={setMinIdx}   width={colMin} />
          </View>

          {/* Preview */}
          <Text style={wh.preview}>
            {pad(safeDayIdx + 1)}/{pad(monthIdx + 1)}/{selectedYear} \u2014 {pad(hourIdx)}:{pad(minIdx)}h
          </Text>

          {/* Botones */}
          <View style={wh.btns}>
            <TouchableOpacity style={[wh.btn, wh.btnCancel]} onPress={onCancel}>
              <Text style={wh.btnCancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[wh.btn, wh.btnConfirm]} onPress={handleConfirm}>
              <Text style={wh.btnConfirmText}>Confirmar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const wh = StyleSheet.create({
  overlay:           { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  sheet:             { backgroundColor: '#15181F', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  title:             { color: '#FFF', fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 16 },
  labelsRow:         { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 4, gap: 4 },
  colLabel:          { color: '#A0A0A0', fontSize: 11, textAlign: 'center' },
  wheels:            { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', height: ITEM_H * VISIBLE, gap: 4 },
  col:               { height: ITEM_H * VISIBLE, overflow: 'hidden' },
  highlight:         { position: 'absolute', top: ITEM_H * PAD, left: 0, right: 0, height: ITEM_H, backgroundColor: 'rgba(243,156,18,0.12)', borderRadius: 8, borderWidth: 1, borderColor: '#F39C12', zIndex: 1 },
  item:              { height: ITEM_H, justifyContent: 'center', alignItems: 'center' },
  itemText:          { color: '#606060', fontSize: 18, fontWeight: '500' },
  itemTextSelected:  { color: '#FFF', fontSize: 22, fontWeight: 'bold' },
  separator:         { justifyContent: 'center', alignItems: 'center', width: 14 },
  separatorText:     { color: '#F39C12', fontSize: 22, fontWeight: 'bold' },
  preview:           { color: '#F39C12', textAlign: 'center', fontSize: 15, fontWeight: 'bold', marginTop: 16, marginBottom: 20 },
  btns:              { flexDirection: 'row', gap: 12 },
  btn:               { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  btnCancel:         { backgroundColor: '#1C1F26', borderWidth: 1, borderColor: '#2A2D35' },
  btnCancelText:     { color: '#A0A0A0', fontWeight: 'bold', fontSize: 15 },
  btnConfirm:        { backgroundColor: '#F39C12' },
  btnConfirmText:    { color: '#000', fontWeight: 'bold', fontSize: 15 },
});
