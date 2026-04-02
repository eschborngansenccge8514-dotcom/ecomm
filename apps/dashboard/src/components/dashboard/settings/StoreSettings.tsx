'use client'
import { useState }     from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button }       from '@/components/ui/button'
import { Input }        from '@/components/ui/input'
import { Label }        from '@/components/ui/label'
import { Palette, MapPin } from 'lucide-react'
import Link             from 'next/link'
import toast            from 'react-hot-toast'

export function StoreSettings({ merchant }: { merchant: any }) {
  const [form, setForm] = useState({
    store_name:         merchant.store_name        ?? '',
    description:        merchant.description       ?? '',
    phone:              merchant.phone             ?? '',
    address_line1:      merchant.address_line1     ?? '',
    city:               merchant.city              ?? '',
    state:              merchant.state             ?? '',
    postcode:           merchant.postcode          ?? '',
    min_order_amount:   merchant.min_order_amount  ?? 0,
    delivery_radius_km: merchant.delivery_radius_km ?? 10,
    lat:                merchant.lat                ?? '',
    lng:                merchant.lng                ?? '',
  })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('merchants').update(form).eq('id', merchant.id)
    if (error) toast.error(error.message)
    else toast.success('Store settings saved!')
    setSaving(false)
  }

  const Field = ({ label, field, type = 'text' }: { label: string; field: keyof typeof form; type?: string }) => (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input type={type} value={String(form[field] ?? '')}
        onChange={e => {
          const val = e.target.value
          setForm(p => ({ ...p, [field]: type === 'number' ? (val === '' ? null : parseFloat(val)) : val }))
        }} />
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-gray-900">Store Info</h2>
          <Link href="/settings/store">
            <Button variant="outline" size="sm" className="flex items-center gap-2">
              <Palette size={13} /> Customize Appearance
            </Button>
          </Link>
        </div>
        <Field label="Store Name"   field="store_name"   />
        <Field label="Phone"        field="phone"        />
        <Field label="Description"  field="description"  />
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
        <h2 className="font-bold text-gray-900">Store Address</h2>
        <Field label="Address"  field="address_line1" />
        <div className="grid grid-cols-2 gap-4">
          <Field label="City"     field="city"     />
          <Field label="Postcode" field="postcode" />
        </div>
        <Field label="State" field="state" />
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-50">
          <Field label="Latitude"  field="lat" type="number" />
          <Field label="Longitude" field="lng" type="number" />
        </div>
        <Button variant="outline" size="sm" type="button" 
          onClick={() => {
            if ('geolocation' in navigator) {
              toast.promise(
                new Promise((resolve, reject) => {
                  navigator.geolocation.getCurrentPosition(
                    (pos) => {
                      setForm(p => ({ ...p, lat: pos.coords.latitude, lng: pos.coords.longitude }))
                      resolve(pos)
                    },
                    (err) => reject(err)
                  )
                }),
                {
                  loading: 'Detecting location...',
                  success: 'Location detected!',
                  error: 'Location access denied or unavailable.',
                }
              )
            } else {
              toast.error('Geolocation not supported')
            }
          }}
          className="flex items-center gap-2 w-full mt-2">
          <MapPin size={14} className="text-blue-600" />
          Use My Location
        </Button>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
        <h2 className="font-bold text-gray-900">Delivery Settings</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Min. Order (RM)"      field="min_order_amount"   type="number" />
          <Field label="Delivery Radius (km)" field="delivery_radius_km" type="number" />
        </div>
      </div>
      <Button onClick={handleSave} disabled={saving} className="w-full h-11 rounded-xl">
        {saving ? 'Saving...' : 'Save Store Settings'}
      </Button>
    </div>
  )
}
