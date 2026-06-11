import { supabase } from '../config/supabase.js';

export async function auditLog(req, action, resourceType, resourceId, details = {}) {
  await supabase.from('audit_log').insert({
    user_id: req.userId || null,
    action,
    resource_type: resourceType,
    resource_id: resourceId,
    ip_address: req.ip || null,
    user_agent: req.headers['user-agent'],
    details
  });
}

export function rateLimit(maxRequests = 50, windowMs = 60000) {
  const requests = new Map();
  
  return (req, res, next) => {
    const key = req.userId || req.ip;
    const now = Date.now();
    
    if (!requests.has(key)) {
      requests.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }
    
    const record = requests.get(key);
    if (now > record.resetTime) {
      record.count = 1;
      record.resetTime = now + windowMs;
      return next();
    }
    
    if (record.count >= maxRequests) {
      return res.status(429).json({ error: 'Rate limit exceeded. Please slow down.' });
    }
    
    record.count++;
    next();
  };
}