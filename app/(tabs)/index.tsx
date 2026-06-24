import React from 'react';
import { StyleSheet, ScrollView, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '../../src/components/Header';
import FilterPills from '../../src/components/FilterPills';
import QuinielaMainCard from '../../src/components/QuinielaMainCard';
import QuickAccessRow from '../../src/components/QuickAccessRow';
import EdgeCard from '../../src/components/EdgeCard';

export default function QuinielasScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" />
      
      <Header />
      <FilterPills />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <QuinielaMainCard />
        <QuickAccessRow />
        <EdgeCard />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0C10' },
  scrollContent: { paddingHorizontal: 15, paddingTop: 5, paddingBottom: 40 },
});