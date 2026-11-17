import React from 'react';
import { ArrowUpRight, Cpu, Layers, Sparkles } from 'lucide-react';
import { PageRoute } from '../data/portfolio';
import { InteractiveCanvasLab } from '../components/canvas/InteractiveCanvasLab';
import { MagneticButton } from '../components/MagneticButton';

interface LabViewProps {
  onNavigate: (route: PageRoute) => void;
}

export const LabView: React.FC<LabViewProps> = ({ onNavigate }) => {
  return (
    <div className="relative z-10 w-full bg-[#05060a]/30">
      <div className="flex w-full flex-col justify-between gap-6 border-b border-white/[0.08] px-5 pb-8 pt-28 sm:px-8 md:flex-row md:items-end lg:px-14">
        <div>
          <div className="font-mono-tech text-xs tracking-[0.24em] text-sky-300">
            03 // CANVAS & SHADER LAB
          </div>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            开源 Canvas 交互{' '}
            <span className="font-serif-display text-liquid-pearl font-normal italic">
              Experiments
            </span>
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-300">
            直接运行在浏览器中的五大开源图形交互引擎：切换顶部引擎标签并调节下方浮动液态玻璃 HUD 控制台参数，实时体验流体求解、3D 物理玻璃晶体、Voronoi 破碎棱镜、粒子变形与 2D 刚体碰撞。
          </p>
        </div>

        <MagneticButton
          variant="glass"
          cursorLabel="WORKS"
          onClick={() => onNavigate('works')}
        >
          <span>查看商业案例应用</span>
          <ArrowUpRight className="h-4 w-4" />
        </MagneticButton>
      </div>

      {/* Main Full-Bleed Interactive Lab */}
      <div className="w-full border-b border-white/[0.08] px-5 py-8 sm:px-8 lg:px-14 lg:py-10">
        <InteractiveCanvasLab initialEngine="shader-fluid" />
      </div>

      {/* Full-Bleed Edge-to-Edge Technical Architecture Notes */}
      <div className="grid w-full grid-cols-1 border-b border-white/[0.08] md:grid-cols-2 md:divide-x lg:grid-cols-3 divide-white/[0.08]">
        <div className="border-b border-white/[0.08] bg-[#05060a]/58 p-6 sm:p-10 lg:p-12">
          <div className="flex items-center gap-2 font-mono-tech text-xs text-sky-300">
            <Sparkles className="h-4 w-4" />
            <span>ENGINE 01 // NAVIER-STOKES FBO</span>
          </div>
          <h2 className="mt-3 text-lg font-semibold text-white">真流体 Navier-Stokes 乒乓 FBO 求解器</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            在 WebGL2 半浮点双缓冲纹理上执行 Splat、Curl 涡度计算、Vorticity Confinement、散度消除、Jacobi 压力迭代与双线性平流，并将速度场实时映射为光学网格色散折射。
          </p>
        </div>

        <div className="border-b border-white/[0.08] bg-[#05060a]/58 p-6 sm:p-10 lg:p-12">
          <div className="flex items-center gap-2 font-mono-tech text-xs text-cyan-200">
            <Sparkles className="h-4 w-4" />
            <span>ENGINE 02 // 3D GLASS STUDIO</span>
          </div>
          <h2 className="mt-3 text-lg font-semibold text-white">PMREM 摄影棚物理折射晶体</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            结合 Three.js MeshPhysicalMaterial 与烘焙柔光箱环境贴图，支持 360° 轨道拖拽与即时切换几何体，实时调控折射率 IOR、色散与表面磨砂度。
          </p>
        </div>

        <div className="border-b border-white/[0.08] bg-[#05060a]/58 p-6 sm:p-10 lg:p-12">
          <div className="flex items-center gap-2 font-mono-tech text-xs text-indigo-300">
            <Layers className="h-4 w-4" />
            <span>ENGINE 03 // VORONOI SHATTER</span>
          </div>
          <h2 className="mt-3 text-lg font-semibold text-white">Voronoi 3D 碎晶浮起透镜</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            通过程序化 Voronoi 单元划分将光学网格分割成可独立旋转、抬升与投射立体阴影的折射碎片，在指针局部形成极具空间张力的破碎玻璃透镜。
          </p>
        </div>

        <div className="border-b border-white/[0.08] bg-[#05060a]/58 p-6 sm:p-10 lg:border-b-0 lg:p-12">
          <div className="flex items-center gap-2 font-mono-tech text-xs text-violet-300">
            <Cpu className="h-4 w-4" />
            <span>ENGINE 04 // GPGPU CURL TOPOLOGY</span>
          </div>
          <h2 className="mt-3 text-lg font-semibold text-white">顶点形态插值与旋度湍流</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            5,200 个粒子在 BufferAttribute 中预烘焙 Sphere、Torus 与 Helix 三套空间拓扑坐标，完全在 GPU 顶点阶段完成形态混合与指针磁场排斥，保证丝滑拖拽旋转。
          </p>
        </div>

        <div className="bg-[#05060a]/58 p-6 sm:p-10 lg:col-span-2 lg:p-12">
          <div className="flex items-center gap-2 font-mono-tech text-xs text-amber-200">
            <Layers className="h-4 w-4" />
            <span>ENGINE 05 // MATTER.JS OPTICS</span>
          </div>
          <h2 className="mt-3 text-lg font-semibold text-white">刚体物理演算与 HiDPI 光学渲染解耦</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            利用 Matter.js 负责刚体碰撞、零重力切换与鼠标弹簧约束，自定义 Canvas 2D HiDPI 绘制循环实时渲染镜面高光弧、胶囊棱镜渐变及径向冲击波反馈，同时屏蔽滚轮劫持保证页面滑动无阻。
          </p>
        </div>
      </div>
    </div>
  );
};
