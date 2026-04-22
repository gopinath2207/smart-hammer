import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster }       from 'react-hot-toast';
import { AuthProvider }  from './context/AuthContext';
import ProtectedRoute    from './components/common/ProtectedRoute';
import Navbar            from './components/common/Navbar';

import Home           from './pages/Home';
import Login          from './pages/Login';
import Register       from './pages/Register';
import AuctionList    from './pages/AuctionList';
import AuctionDetail  from './pages/AuctionDetail';
import CreateAuction  from './pages/CreateAuction';
import Dashboard      from './pages/Dashboard';
import Payment        from './pages/Payment';
import NotFound       from './pages/NotFound';

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
      <Navbar />
      <Routes>
        <Route path="/"         element={<Home />}         />
        <Route path="/login"    element={<Login />}        />
        <Route path="/register" element={<Register />}     />
        <Route path="/auctions" element={<AuctionList />}  />
        <Route path="/auctions/:id" element={<AuctionDetail />} />

        <Route path="/create-auction" element={
          <ProtectedRoute roles={['seller', 'admin']}>
            <CreateAuction />
          </ProtectedRoute>
        } />

        <Route path="/dashboard" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />

        <Route path="/payment/:auctionId" element={
          <ProtectedRoute>
            <Payment />
          </ProtectedRoute>
        } />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthProvider>
  </BrowserRouter>
);

export default App;