export type ToolContextWithMetadata = {
	sessionID: string
	messageID: string
	agent: string
	abort: AbortSignal
	callID?: string
	callId?: string
	call_id?: string
	metadata?: (input: {
		title?: string
		metadata?: Record<string, unknown>
	}) => void
}
