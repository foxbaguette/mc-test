import { Navigate, Route, Routes } from 'react-router-dom'

import { PageHeader } from '@/components/PageHeader'
import { publicUrl } from '@/lib/publicUrl'

import { History } from './History'
import { Tasks } from './Tasks'

import './Emporium.css'

export default function Emporium() {
  return (
    <>
      <PageHeader title="Zapp’s Zap Emporium" image={publicUrl('/assets/background/bg-emporium.webp')} />
      <div className="page zap plates">
        <Routes>
          <Route index element={<Tasks />} />
          <Route path="history" element={<History />} />
          <Route path="*" element={<Navigate to="/emporium" replace />} />
        </Routes>
      </div>
    </>
  )
}
