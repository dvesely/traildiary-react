import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView } from 'react-native'
import { useState } from 'react'
import { router } from 'expo-router'
import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system'
import { GpxParser, FitParser } from '@traildiary/core'
import { useImport } from '@traildiary/ui'

const parsers = [new GpxParser(), new FitParser()]

async function readFileAsArrayBuffer(uri: string): Promise<ArrayBuffer> {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  })
  const binary = atob(base64)
  const buf = new ArrayBuffer(binary.length)
  const view = new Uint8Array(buf)
  for (let i = 0; i < binary.length; i++) {
    view[i] = binary.charCodeAt(i)
  }
  return buf
}

export default function ImportScreen() {
  const [trailName, setTrailName] = useState('')
  const [selectedFiles, setSelectedFiles] = useState<{ name: string; uri: string }[]>([])
  const { importFiles, progress } = useImport(parsers)

  async function pickFiles() {
    const result = await DocumentPicker.getDocumentAsync({ multiple: true, type: '*/*' })
    if (!result.canceled) {
      setSelectedFiles(result.assets.map((a) => ({ name: a.name, uri: a.uri })))
    }
  }

  async function handleImport() {
    if (!trailName.trim() || selectedFiles.length === 0) return
    const filesData = await Promise.all(
      selectedFiles.map(async (f) => ({
        name: f.name,
        data: await readFileAsArrayBuffer(f.uri),
      }))
    )
    const trailId = await importFiles(trailName.trim(), filesData)
    if (trailId) router.replace(`/trail/${trailId}`)
  }

  const isImporting = progress.status === 'parsing' || progress.status === 'saving'

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <TextInput
        style={styles.input}
        placeholder="Trail name"
        placeholderTextColor="#6b7280"
        value={trailName}
        onChangeText={setTrailName}
        autoFocus
      />

      <TouchableOpacity style={styles.pickBtn} onPress={pickFiles}>
        <Text style={styles.btnText}>
          {selectedFiles.length > 0
            ? `${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''} selected`
            : 'Pick GPX / FIT files'}
        </Text>
      </TouchableOpacity>

      {selectedFiles.map((f) => (
        <Text key={f.uri} style={styles.fileName} numberOfLines={1}>
          {f.name}
        </Text>
      ))}

      {isImporting && (
        <View style={styles.progressRow}>
          <ActivityIndicator color="#3b82f6" />
          <Text style={styles.progressText}>{progress.message}</Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.importBtn, (!trailName.trim() || !selectedFiles.length || isImporting) && styles.disabled]}
        onPress={handleImport}
        disabled={!trailName.trim() || !selectedFiles.length || isImporting}
      >
        <Text style={styles.btnText}>Import</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111' },
  content: { padding: 16, gap: 12 },
  input: { backgroundColor: '#1f2937', color: '#fff', padding: 14, borderRadius: 8, fontSize: 16 },
  pickBtn: { backgroundColor: '#374151', padding: 14, borderRadius: 8, alignItems: 'center' },
  importBtn: { backgroundColor: '#3b82f6', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 4 },
  disabled: { opacity: 0.4 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  fileName: { color: '#9ca3af', fontSize: 13, paddingHorizontal: 4 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressText: { color: '#9ca3af', fontSize: 13 },
})
