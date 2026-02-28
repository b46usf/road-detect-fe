"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { AdaptiveDataColumn } from "./adaptive-data-table"

interface UseAdaptiveDataTableArgs<T> {
  rows: T[]
  columns: AdaptiveDataColumn<T>[]
  rowKey: (row: T) => string
  pageSize: number
}

export function useAdaptiveDataTable<T>(args: UseAdaptiveDataTableArgs<T>) {
  const { rows, columns, rowKey, pageSize } = args

  const [query, setQuery] = useState("")
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [pageState, setPageState] = useState<{ key: string; pages: number }>({
    key: "",
    pages: 1
  })

  const loadTimerRef = useRef<number | null>(null)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  const normalizedQuery = query.trim().toLowerCase()

  const filteredRows = useMemo(() => {
    if (!normalizedQuery) {
      return rows
    }

    return rows.filter((row) => {
      return columns.some((column) => {
        if (!column.searchValue) {
          return false
        }

        return column.searchValue(row).toLowerCase().includes(normalizedQuery)
      })
    })
  }, [columns, normalizedQuery, rows])

  const signature = useMemo(() => {
    if (filteredRows.length === 0) {
      return "empty"
    }

    const first = rowKey(filteredRows[0])
    const last = rowKey(filteredRows[filteredRows.length - 1])
    return `${filteredRows.length}:${first}:${last}`
  }, [filteredRows, rowKey])

  const stateKey = `${signature}:${normalizedQuery}`

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const loadedPagesRaw = pageState.key === stateKey ? pageState.pages : 1
  const loadedPages = Math.min(Math.max(1, loadedPagesRaw), totalPages)

  const visibleRows = useMemo(() => {
    return filteredRows.slice(0, loadedPages * pageSize)
  }, [filteredRows, loadedPages, pageSize])

  const hasMore = loadedPages < totalPages

  const loadMore = useCallback(() => {
    if (isLoadingMore || !hasMore) {
      return
    }

    setIsLoadingMore(true)

    if (loadTimerRef.current) {
      window.clearTimeout(loadTimerRef.current)
      loadTimerRef.current = null
    }

    loadTimerRef.current = window.setTimeout(() => {
      setPageState((previous) => {
        const currentPage = previous.key === stateKey ? previous.pages : 1
        return {
          key: stateKey,
          pages: Math.min(totalPages, currentPage + 1)
        }
      })
      setIsLoadingMore(false)
      loadTimerRef.current = null
    }, 220)
  }, [hasMore, isLoadingMore, stateKey, totalPages])

  const loadPrevious = useCallback(() => {
    setPageState((previous) => {
      const currentPage = previous.key === stateKey ? previous.pages : 1
      return {
        key: stateKey,
        pages: Math.max(1, currentPage - 1)
      }
    })
  }, [stateKey])

  useEffect(() => {
    const node = sentinelRef.current
    if (!node || !hasMore) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            loadMore()
          }
        }
      },
      { root: null, rootMargin: "220px", threshold: 0.1 }
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [hasMore, loadMore])

  useEffect(() => {
    return () => {
      if (loadTimerRef.current) {
        window.clearTimeout(loadTimerRef.current)
      }
    }
  }, [])

  const resetToFirstPage = useCallback(() => {
    setPageState({ key: stateKey, pages: 1 })
  }, [stateKey])

  return {
    query,
    setQuery,
    visibleRows,
    filteredRows,
    loadedPages,
    totalPages,
    hasMore,
    isLoadingMore,
    loadMore,
    loadPrevious,
    resetToFirstPage,
    sentinelRef
  }
}
