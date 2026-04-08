// App.jsx already verifies the user is not a freelancer before rendering
// admin routes — no need for a second getFreelancerData call here.
export default function AdminRoute({ children }) {
  return children;
}
