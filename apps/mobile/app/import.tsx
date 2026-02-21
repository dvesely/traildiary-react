import { FitParser, GpxParser } from '@traildiary/core'
import { useImport } from '@traildiary/ui'
import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system'
import { router } from 'expo-router'
import { useState } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { logger } from '../src/infrastructure/logger'

const parsers = [new GpxParser(logger), new FitParser(logger)]

async function readFileAsArrayBuffer(
  uri: string,
  fileName: string,
): Promise<ArrayBuffer> {
  // GPX is text: read as UTF-8 string and encode natively — avoids the slow
  // base64 → atob() → char-by-char JS loop (O(n) on Hermes, ~3 s per MB).
  if (fileName.toLowerCase().endsWith('.gpx')) {
    const text = await FileSystem.readAsStringAsync(uri)
    return new TextEncoder().encode(text).buffer as ArrayBuffer
  }
  // Binary formats (FIT, etc.): must go through base64.
  // FIT files are compact, so the loop is fast enough.
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
  const [selectedFiles, setSelectedFiles] = useState<
    { name: string; uri: string }[]
  >([])
  const { importFiles, progress } = useImport(parsers)

  async function pickFiles() {
    const result = await DocumentPicker.getDocumentAsync({
      multiple: true,
      type: '*/*',
    })
    if (!result.canceled) {
      setSelectedFiles(result.assets.map((a) => ({ name: a.name, uri: a.uri })))
    }
  }

  async function handleImport() {
    if (!trailName.trim() || selectedFiles.length === 0) return
    const filesData = await Promise.all(
      selectedFiles.map(async (f) => ({
        name: f.name,
        data: await readFileAsArrayBuffer(f.uri, f.name),
      })),
    )
    const trailId = await importFiles(trailName.trim(), filesData)
    if (trailId) router.replace(`/trail/${trailId}`)
  }

  const isImporting =
    progress.status === 'parsing' || progress.status === 'saving'

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
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
        style={[
          styles.importBtn,
          (!trailName.trim() || !selectedFiles.length || isImporting) &&
            styles.disabled,
        ]}
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
  input: {
    backgroundColor: '#1f2937',
    color: '#fff',
    padding: 14,
    borderRadius: 8,
    fontSize: 16,
  },
  pickBtn: {
    backgroundColor: '#374151',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  importBtn: {
    backgroundColor: '#3b82f6',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 4,
  },
  disabled: { opacity: 0.4 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  fileName: { color: '#9ca3af', fontSize: 13, paddingHorizontal: 4 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressText: { color: '#9ca3af', fontSize: 13 },
})
