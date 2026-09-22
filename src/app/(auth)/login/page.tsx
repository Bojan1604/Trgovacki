import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { LoginForm } from './login-form';

export const metadata = { title: 'Prijava' };

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect('/dashboard');

  const demo = process.env.NODE_ENV !== 'production';

  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_440px]">
      {/* Lijeva strana — vizualni identitet */}
      <div className="relative hidden overflow-hidden bg-ink lg:block">
        <div
          className="absolute inset-0 opacity-90"
          style={{
            background:
              'radial-gradient(1000px 600px at 15% 15%, #1b4b8f 0%, transparent 55%), radial-gradient(800px 500px at 85% 85%, #0a3f6e 0%, transparent 55%), linear-gradient(140deg, #08111d 0%, #0d1b2c 100%)',
          }}
        />
        <div className="relative flex h-full flex-col justify-between p-10 text-white">
          <div className="flex items-center gap-2">
            <div className="grid size-7 place-items-center rounded-lg bg-white/15 backdrop-blur">
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18l-1.6 9.2a2 2 0 0 1-2 1.8H6.6a2 2 0 0 1-2-1.8Z" />
                <path d="M8 6V4.5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2V6" />
              </svg>
            </div>
            <span className="text-md font-semibold tracking-tight">Trgovački</span>
          </div>

          <div className="max-w-md">
            <h1 className="text-[32px] font-semibold leading-[1.15] tracking-tight">
              Maloprodajni sustav za trgovačke lance.
            </h1>
            <p className="mt-3 text-md leading-relaxed text-white/65">
              Blagajna, zalihe, nabava, kalkulacije, cjenici, akcije, vjernost i izvještaji —
              u jednom sustavu, od jedne trgovine do stotina poslovnica.
            </p>
            <ul className="mt-6 grid grid-cols-2 gap-x-6 gap-y-2 text-base text-white/55">
              {[
                'Rad na blagajni bez mreže',
                'Kalkulacije i marže',
                'Međuskladišnice i inventure',
                'Akcije i program vjernosti',
                'Revizijski trag svake radnje',
                'Fiskalizacija po adapteru',
              ].map((item) => (
                <li key={item} className="flex items-center gap-1.5">
                  <span className="size-[4px] rounded-full bg-white/40" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <p className="text-sm text-white/35">
            © {new Date().getFullYear()} Trgovački · Sva prava pridržana
          </p>
        </div>
      </div>

      {/* Desna strana — obrazac */}
      <div className="flex items-center justify-center bg-surface px-6 py-10">
        <div className="w-full max-w-[320px]">
          <div className="mb-6 lg:hidden">
            <div className="mb-2 grid size-8 place-items-center rounded-lg bg-accent text-white">
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18l-1.6 9.2a2 2 0 0 1-2 1.8H6.6a2 2 0 0 1-2-1.8Z" />
                <path d="M8 6V4.5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2V6" />
              </svg>
            </div>
          </div>

          <h2 className="text-lg font-semibold tracking-tight">Prijava</h2>
          <p className="mt-0.5 mb-5 text-sm text-ink-3">Unesite podatke za pristup sustavu.</p>

          <LoginForm />

          {demo && (
            <div className="mt-6 rounded-lg bg-surface-2 p-2.5 text-sm">
              <p className="mb-1 font-medium text-ink-2">Demo pristup</p>
              <dl className="space-y-0.5 text-ink-3">
                <div className="flex justify-between gap-2">
                  <dt>Vlasnik</dt>
                  <dd className="font-mono text-xs">vlasnik@trgovacki.hr · demo1234</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>Voditelj</dt>
                  <dd className="font-mono text-xs">voditelj@trgovacki.hr · demo1234</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>Blagajnik</dt>
                  <dd className="font-mono text-xs">blagajna@trgovacki.hr · demo1234</dd>
                </div>
              </dl>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
