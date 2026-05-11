// tests/helpers/mock-channel.ts — Captura calls de channelClient.send.
//
// channelClient.send delega para getChannelAdapter(workspace_id).send(...). Em testes,
// substituímos o método send do channelClient diretamente — mais simples e suficiente,
// já que o orchestrator usa apenas channelClient.send.

import * as ext from '@/lib/resilience/external-clients'

interface CapturedSend {
  workspace_id: string
  to: string
  message: { text: string; media_url?: string; media_type?: string }
}

export const capturedSent: CapturedSend[] = []
let shouldFail = false

const ORIGINAL_SEND = ext.channelClient.send

function installMock(): void {
  ext.channelClient.send = (async (
    workspace_id: string,
    to: string,
    message: { text: string; media_url?: string; media_type?: string },
  ) => {
    if (shouldFail) {
      throw new Error('mock_channel_send_failed')
    }
    capturedSent.push({ workspace_id, to, message })
  }) as typeof ext.channelClient.send
}

export function getLastSent(): CapturedSend | undefined {
  return capturedSent[capturedSent.length - 1]
}

export function getAllSent(): ReadonlyArray<CapturedSend> {
  return capturedSent
}

export function resetCapture(): void {
  capturedSent.length = 0
  shouldFail = false
  installMock()
}

export function makeChannelFail(): void {
  shouldFail = true
}

export function restoreChannel(): void {
  ext.channelClient.send = ORIGINAL_SEND
}

installMock()
