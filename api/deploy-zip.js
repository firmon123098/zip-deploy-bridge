export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { zipUrl, projectName, vercelToken } = req.body;

    if (!zipUrl || !projectName || !vercelToken) {
      return res.status(400).json({ error: 'Missing zipUrl, projectName, or vercelToken' });
    }

    const zipRes = await fetch(zipUrl);
    if (!zipRes.ok) {
      return res.status(400).json({ error: 'Failed to download zip file' });
    }
    const zipBuffer = Buffer.from(await zipRes.arrayBuffer());

    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(zipBuffer);

    const files = [];
    for (const [relativePath, entry] of Object.entries(zip.files)) {
      if (entry.dir) continue;
      const content = await entry.async('base64');
      files.push({ file: relativePath, data: content, encoding: 'base64' });
    }

    if (files.length === 0) {
      return res.status(400).json({ error: 'Zip file is empty' });
    }

    const deployRes = await fetch('https://api.vercel.com/v13/deployments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${vercelToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: projectName,
        files: files,
        target: 'production',
        projectSettings: { framework: null }
      })
    });

    const deployData = await deployRes.json();

    if (!deployRes.ok) {
      return res.status(500).json({ error: deployData.error?.message || 'Deployment failed' });
    }

    return res.status(200).json({ success: true, url: `https://${deployData.url}` });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
