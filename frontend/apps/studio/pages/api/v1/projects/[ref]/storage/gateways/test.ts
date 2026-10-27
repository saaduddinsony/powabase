import { NextApiRequest, NextApiResponse } from 'next'
import apiWrapper from '@/lib/api/apiWrapper'

export default (req: NextApiRequest, res: NextApiResponse) => apiWrapper(req, res, handler)

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ error: { message: `Method ${req.method} Not Allowed` } })
  }

  const { endpoint_url, access_key, secret_key } = req.body || {}
  if (!endpoint_url) {
    return res.status(400).json({ error: { message: 'endpoint_url is required' } })
  }

  try {
    const cleanUrl = endpoint_url.trim().replace(/\/+$/, '')
    const targetUrl = `${cleanUrl}/`

    // Test ping to remote S3 / socket-storage.php endpoint
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/xml',
        Authorization: `Bearer ${secret_key || ''}`,
      },
    })

    const text = await response.text()
    const isS3 =
      text.includes('ListAllMyBucketsResult') ||
      text.includes('ListBucketResult') ||
      text.includes('<Buckets>') ||
      text.includes('AccessDenied') ||
      text.includes('<Error>') ||
      response.status === 200 ||
      response.status === 403

    if (isS3) {
      const bucketMatch = text.match(/<Name>(.*?)<\/Name>/g)
      const bucketCount = bucketMatch ? bucketMatch.length : 0
      return res.status(200).json({
        success: true,
        status: response.status,
        message: 'Successfully connected to S3 Storage Gateway!',
        bucketCount,
        endpoint: cleanUrl,
      })
    }

    return res.status(200).json({
      success: true,
      status: response.status,
      message: `Gateway responded with HTTP ${response.status}`,
      endpoint: cleanUrl,
    })
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error: { message: `Connection failed: ${error.message}` },
    })
  }
}
