const Member = require('../models/Member');

function requireRole(...allowedRoles) {
  return async function roleMiddleware(req, res, next) {
    try {
      const workspaceId = req.params.workspaceId || req.body.workspaceId;

      if (!workspaceId) {
        return res.status(400).json({ error: 'workspaceId is required' });
      }

      const member = await Member.findOne({ workspaceId, userId: req.user.id });

      if (!member) {
        return res.status(403).json({ error: 'Not a member of this workspace' });
      }

      if (!allowedRoles.includes(member.role)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      req.member = member;
      return next();
    } catch (error) {
      return res.status(500).json({ error: 'Something went wrong' });
    }
  };
}

module.exports = requireRole;