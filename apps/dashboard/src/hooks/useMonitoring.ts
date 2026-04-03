'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js'

export type Order = {
  id: string
  order_number: string
  status: string
  payment_status: string
  payment_method: string
  total_amount: number
  delivery_provider: string
  delivery_status: string
  delivery_fee: number
  delivery_tracking_id: string
  delivery_tracking_url?: string
  lalamove_order_id: string
  easyparcel_order_no: string
  tracking_number: string
  driver_name: string
  driver_phone: string
  driver_plate: string
  driver_photo_url?: string
  last_driver_lat: number
  last_driver_lng: number
  last_driver_update_at: string
  exception_flag: string
  exception_flagged_at: string
  delivery_metadata?: any
  delivery_address?: any
  buyer_name?: string
  created_at: string
  updated_at: string
}

export type DeliveryEvent = {
  id: string
  order_id: string
  provider: string
  event_type: string
  raw_payload: any
  created_at: string
}

export type PaymentEvent = {
  id: string
  order_id: string
  event_type: string
  gateway: string
  raw_payload: any
  created_at: string
}

export type Notification = {
  id: string
  title: string
  body: string
  type: string
  is_read: boolean
  data: any
  created_at: string
}

export function useMonitoring(merchantId: string) {
  const [orders, setOrders] = useState<Order[]>([])
  const [deliveryEvents, setDeliveryEvents] = useState<DeliveryEvent[]>([])
  const [paymentEvents, setPaymentEvents] = useState<PaymentEvent[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  // Stable client reference — never recreated, never a useEffect dependency
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  const fetchInitialData = useCallback(async () => {
    try {
      setLoading(true)

      // Fetch orders with only the columns the UI needs
      const { data: ordersData } = await supabase
        .from('orders')
        .select('id, order_number, status, payment_status, payment_method, total_amount, delivery_provider, delivery_status, delivery_fee, delivery_tracking_id, delivery_tracking_url, lalamove_order_id, easyparcel_order_no, tracking_number, driver_name, driver_phone, driver_plate, driver_photo_url, last_driver_lat, last_driver_lng, last_driver_update_at, exception_flag, exception_flagged_at, delivery_metadata, delivery_address, buyer_name, created_at, updated_at')
        .eq('merchant_id', merchantId)
        .order('updated_at', { ascending: false })
        .limit(50)

      // Fetch delivery + payment events and notifications in parallel
      const orderIds = (ordersData || []).map(o => o.id)
      const [
        { data: deliveryEventsData },
        { data: paymentEventsData },
        { data: notificationsData },
      ] = await Promise.all([
        supabase
          .from('delivery_events')
          .select('*')
          .in('order_id', orderIds.length ? orderIds : ['00000000-0000-0000-0000-000000000000'])
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('payment_events')
          .select('*')
          .in('order_id', orderIds.length ? orderIds : ['00000000-0000-0000-0000-000000000000'])
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('notifications')
          .select('*')
          .eq('is_read', false)
          .order('created_at', { ascending: false })
          .limit(20),
      ])

      setOrders(ordersData || [])
      setDeliveryEvents(deliveryEventsData || [])
      setPaymentEvents(paymentEventsData || [])
      setNotifications(notificationsData || [])
    } catch (error) {
      console.error('Error fetching monitoring data:', error)
    } finally {
      setLoading(false)
    }
  }, [merchantId]) // supabase is stable via ref — safe to omit

  useEffect(() => {
    fetchInitialData()

    const ordersChannel = supabase
      .channel(`monitoring-orders-${merchantId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'orders',
        filter: `merchant_id=eq.${merchantId}`
      }, (payload: RealtimePostgresChangesPayload<Order>) => {
        if (payload.eventType === 'INSERT') {
          setOrders(prev => [payload.new as Order, ...prev])
        } else if (payload.eventType === 'UPDATE') {
          setOrders(prev => prev.map(o => o.id === (payload.new as Order).id ? payload.new as Order : o))
        } else if (payload.eventType === 'DELETE') {
          setOrders(prev => prev.filter(o => o.id !== (payload.old as Order).id))
        }
      })
      .subscribe()

    const eventsChannel = supabase
      .channel(`monitoring-events-${merchantId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'delivery_events' },
        (payload) => setDeliveryEvents(prev => [payload.new as DeliveryEvent, ...prev]))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'payment_events' },
        (payload) => setPaymentEvents(prev => [payload.new as PaymentEvent, ...prev]))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setNotifications(prev => [payload.new as Notification, ...prev])
          } else if (payload.eventType === 'UPDATE') {
            setNotifications(prev => prev.map(n => n.id === (payload.new as Notification).id ? payload.new as Notification : n))
          }
        })
      .subscribe()

    return () => {
      supabase.removeChannel(ordersChannel)
      supabase.removeChannel(eventsChannel)
    }
  }, [merchantId, fetchInitialData]) // supabase is stable — safe to omit from deps

  const markAsRead = async (notificationId: string) => {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
  }

  return { orders, deliveryEvents, paymentEvents, notifications, loading, refresh: fetchInitialData, markAsRead }
}
