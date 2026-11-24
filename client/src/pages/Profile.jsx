import { useAuth } from '../context/AuthContext.jsx';
export default function Profile() {
  const { user, refresh } = useAuth();
  return <div><div className="hero"><div><h1>Profile</h1><p>Account information, role, and preferences.</p></div></div>
    <div className="card" style={{maxWidth:720}}><div className="grid g2"><label className="field"><span>Name</span><input value={user?.name||''} readOnly/></label><label className="field"><span>Email</span><input value={user?.email||''} readOnly/></label><label className="field"><span>Role</span><input value={user?.role||''} readOnly/></label><label className="field"><span>Theme</span><input value="GridGuard Teal" readOnly/></label></div><p className="muted">Password and preference updates can be added through PATCH /api/auth/me.</p></div>
  </div>;
}
