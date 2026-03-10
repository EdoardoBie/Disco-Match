import { Outlet } from 'react-router-dom';
import { WebGLShader } from '@/components/ui/web-gl-shader';

export default function Layout() {
  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-[#934517]/30">
      <WebGLShader />
      <main className="max-w-md mx-auto min-h-screen relative flex flex-col z-10">
        <div className="relative z-10 p-6 flex-1 flex flex-col">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
