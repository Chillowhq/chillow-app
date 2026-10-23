"use client"

import { useEffect, useRef, useState } from "react"

/**
 * useEventSource hook
 * Connects to a server-sent events (SSE) stream and handles reconnections.
 */
export function useEventSource(
    url: string,
    handlers: Record<string, (data: any) => void>,
    options?: {
        onReconnect?: () => void
        onOpen?: () => void
        recoverOnVisibility?: boolean
    }
) {
    const eventSourceRef = useRef<EventSource | null>(null)
    const handlersRef = useRef(handlers)
    const optionsRef = useRef(options)
    const hasConnectedOnce = useRef(false)
    const [isConnected, setIsConnected] = useState(false)

    // Keep handlers up to date without triggering reconnection
    useEffect(() => {
        handlersRef.current = handlers
    }, [handlers])

    useEffect(() => {
        optionsRef.current = options
    }, [options])

    useEffect(() => {
        if (!url) return

        const connect = () => {
            // Close existing if any
            if (eventSourceRef.current) {
                eventSourceRef.current.close()
            }

            const absoluteUrl = url.startsWith("http")
                ? url
                : `${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000"}${url}`

            const es = new EventSource(absoluteUrl, { withCredentials: true })
            eventSourceRef.current = es

            es.onopen = () => {
                setIsConnected(true)

                // First connection
                if (!hasConnectedOnce.current) {
                    hasConnectedOnce.current = true
                    optionsRef.current?.onOpen?.()
                    return
                }

                // Reconnection after sleep/network loss
                optionsRef.current?.onReconnect?.()
            }

            es.onerror = (err) => {
                console.error(`[SSE] Connection error: ${url}`, err)
                setIsConnected(false)
                // Native EventSource will automatically try to reconnect.
            }

            // Attach dynamic handlers
            Object.keys(handlersRef.current).forEach((eventName) => {
                es.addEventListener(eventName, (event: MessageEvent) => {
                    try {
                        const data = JSON.parse(event.data)
                        handlersRef.current[eventName](data)
                    } catch (err) {
                        console.error(`[SSE] Failed to parse event: ${eventName}`, err)
                    }
                })
            })

        }

        connect()

        const handleVisibilityChange = () => {
            if (
                document.visibilityState === "visible" &&
                optionsRef.current?.recoverOnVisibility !== false
            ) {
                optionsRef.current?.onReconnect?.()
            }
        }

        document.addEventListener("visibilitychange", handleVisibilityChange)

        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange)

            if (eventSourceRef.current) {
                eventSourceRef.current.close()
                eventSourceRef.current = null
            }

            setIsConnected(false)
            hasConnectedOnce.current = false
        }
    }, [url])

    return {
        isConnected,
        close: () => eventSourceRef.current?.close(),
    }
}
