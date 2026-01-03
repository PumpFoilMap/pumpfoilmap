import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, TextInput, Pressable, ScrollView, Image } from 'react-native';
import { SubmitSuccessModal } from './components/SubmitSuccessModal';
import Map from './components/Map';
import sampleData from './data/sample-spots.json';
import { fetchSpots, submitSpot, type SubmitSpotInput, checkAdminPassword, getCaptcha, verifyCaptcha } from './services/api';
import { md5 as md5hash } from './services/md5';
import type { HeatPoint } from './components/Map';

type ActionBarProps = {
  isCompact: boolean;
  onAddPonton: () => void;
  onAddAssociation: () => void;
  onAdmin: () => void;
};

function ActionBar({ isCompact, onAddPonton, onAddAssociation, onAdmin }: ActionBarProps) {
  const containerStyle: any = {
    flexDirection: 'row',
    // Keep actions in a horizontal row that can wrap, but don't force full width so it can sit on the same line as the title when space allows
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    alignItems: 'center'
  };
  const primaryBtn = {
    backgroundColor: '#0b3d91',
    paddingVertical: 8,
    paddingHorizontal: isCompact ? 10 : 14,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    marginRight: isCompact ? 6 : 8,
    marginBottom: 8,
    flexShrink: 1 as const
  };
  const adminBtn = {
    backgroundColor: '#ddd',
    paddingVertical: 8,
    paddingHorizontal: isCompact ? 10 : 14,
    borderRadius: 20,
    marginLeft: isCompact ? 6 : 8,
    marginBottom: 8,
    flexShrink: 1 as const
  };
  return (
    <View style={containerStyle}>
      <Pressable testID="btn-add-ponton" onPress={onAddPonton} style={primaryBtn as any}>
        <Text style={{ color: 'white', fontWeight: '600' }}>
          {isCompact ? 'Proposer ponton' : 'Proposer un nouveau ponton'}
        </Text>
      </Pressable>
      <Pressable testID="btn-add-association" onPress={onAddAssociation} style={primaryBtn as any}>
        <Text style={{ color: 'white', fontWeight: '600' }}>
          {isCompact ? 'Proposer association' : 'Proposer une nouvelle association'}
        </Text>
      </Pressable>
      <Pressable onPress={onAdmin} style={adminBtn as any}>
        <Text style={{ color: '#333', fontWeight: '600' }}>Admin</Text>
      </Pressable>
    </View>
  );
}

export default function App() {
  const showLogos = (process.env.EXPO_PUBLIC_DISABLE_LOGOS ?? '0') !== '1';
  const [points, setPoints] = useState<HeatPoint[]>(sampleData.points as unknown as HeatPoint[]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showGdpr, setShowGdpr] = useState<boolean>(() => {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem('pfm-consent') !== 'ok';
  });
  const [admin, setAdmin] = useState<boolean>(false);
  const [adminPrompt, setAdminPrompt] = useState<boolean>(false);
  const [adminPass, setAdminPass] = useState<string>('');
  const [adminAuthError, setAdminAuthError] = useState<string | null>(null);
  const [adminAuthLoading, setAdminAuthLoading] = useState<boolean>(false);
  // Store md5 of the admin password after successful authentication; never expose server ADMIN_TOKEN
  const [adminMd5Token, setAdminMd5Token] = useState<string | null>(null);
  const [form, setForm] = useState<any>({
    type: 'ponton',
    name: '',
    lat: '',
    lng: '',
    submittedBy: '',
    heightCm: '',
    lengthM: '',
    access: 'autorise',
    address: '',
    description: '',
    imageUrl: '',
    contactEmail: ''
  });
  const [captchaSecret, setCaptchaSecret] = useState<string | null>(null);
  const [captchaSvgUrl, setCaptchaSvgUrl] = useState<string | null>(null);
  const [captchaAnswer, setCaptchaAnswer] = useState<string>('');
  const [captchaVerified, setCaptchaVerified] = useState<boolean>(false);
  const [captchaError, setCaptchaError] = useState<string | null>(null);
  const [captchaLoading, setCaptchaLoading] = useState<boolean>(false);
  const [submitModalOpen, setSubmitModalOpen] = useState<boolean>(false);

  // Build a safe data URL for an inline SVG. Prefer base64 for cross-browser reliability.
  function buildSvgDataUrl(svg: string): string {
    try {
      return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
    } catch {
      return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
    }
  }

  // Minimal fallback SVG shown when backend captcha cannot be fetched (CI/offline).
  function fallbackCaptchaSvg(): string {
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="160" height="60">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#eee"/><stop offset="1" stop-color="#ddd"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="160" height="60" fill="url(#g)" stroke="#ccc"/>
  <text x="80" y="32" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="14" fill="#333">captcha</text>
</svg>`;
    return buildSvgDataUrl(svg);
  }

  function isValidUrl(u?: string) {
    if (!u) return true;
    try {
      new URL(u);
      return true;
    } catch {
      return false;
    }
  }

  function isValidEmail(e?: string) {
    if (!e) return true;
    return /.+@.+\..+/.test(e);
  }

  function validateForm(f: any): Record<string, string> {
    const errs: Record<string, string> = {};
    if (!f.name?.trim()) errs.name = 'Nom requis';
    if (!f.submittedBy?.trim()) errs.submittedBy = 'Soumis par requis';
  const latEmpty = f.lat === '' || f.lat == null;
  const lngEmpty = f.lng === '' || f.lng == null;
  const lat = Number(f.lat), lng = Number(f.lng);
  if (latEmpty || lngEmpty || !Number.isFinite(lat) || !Number.isFinite(lng)) errs.latlng = 'Coordonnées requises';
    if (f.imageUrl && !isValidUrl(f.imageUrl)) errs.imageUrl = 'URL image invalide';
    if (!isValidEmail(f.contactEmail)) errs.contactEmail = 'Email invalide';
    if (f.type === 'ponton') {
      const h = Number(f.heightCm), l = Number(f.lengthM);
      if (!(h > 0)) errs.heightCm = 'Hauteur > 0 requise';
      if (!(l > 0)) errs.lengthM = 'Longueur > 0 requise';
      if (!f.address?.trim()) errs.address = 'Adresse requise';
      if (!['autorise', 'tolere'].includes(f.access)) errs.access = 'Accès invalide';
    } else if (f.type === 'association') {
      if (f.url && !isValidUrl(f.url)) errs.url = 'URL invalide';
    }
    return errs;
  }

  useEffect(() => {
    let mounted = true;
    const hasApi = Boolean(process.env.EXPO_PUBLIC_API_BASE_URL);
    if (hasApi) {
      fetchSpots({ limit: 500 })
        .then((data) => {
          if (!mounted) return;
          const pts = data.items
            .filter((s: any) => typeof s.lat === 'number' && typeof s.lng === 'number')
            .map((s: any) => ({
              lat: s.lat,
              lon: s.lng,
              weight: 1,
              title: s.name ?? `Spot` ,
              description: s.description ?? '',
              type: s.type as 'ponton' | 'association' | undefined,
              url: s.url || s.website,
              address: s.address,
              submittedBy: s.submittedBy,
              createdAt: s.createdAt,
              heightCm: s.heightCm,
              lengthM: s.lengthM,
              access: s.access,
              imageUrl: s.imageUrl
            }));
          if (pts.length) setPoints(pts);
        })
        .catch((e) => setError(String(e)))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
    return () => {
      mounted = false;
    };
  }, []);

  // Fetch captcha immediately when the submission form is shown
  useEffect(() => {
    let mounted = true;
    async function loadCaptchaOnFormOpen() {
      if (!showForm) return;
      // If captcha was already validated previously, don't reset or fetch a new one
      if (captchaVerified) return;
      // reset state and fetch a fresh captcha
      setCaptchaVerified(false);
      setCaptchaError(null);
      setCaptchaAnswer('');
      // Ensure image renders immediately in CI/offline by setting a placeholder
      setCaptchaSvgUrl(fallbackCaptchaSvg());
      setCaptchaSecret('DEV_FAKE');
      try {
        const { data, secret } = await getCaptcha();
        const url = buildSvgDataUrl(data);
        if (!mounted) return;
        setCaptchaSecret(secret);
        setCaptchaSvgUrl(url);
        if (process.env.NODE_ENV !== 'production') {
          try { (window as any).PFM_TEST = { ...(window as any).PFM_TEST, captchaSecret: secret }; } catch {}
        }
      } catch {
        if (!mounted) return;
        setCaptchaError('Erreur de chargement du captcha');
        // keep fallback image/secret already set
      } finally {
        if (mounted) {
          setCaptchaLoading(false);
        }
      }
    }
    loadCaptchaOnFormOpen();
    return () => { mounted = false; };
  }, [showForm]);

  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: 12, backgroundColor: '#0b3d91' }}>
        <View
          style={{
            // Title and actions on the same line when space allows; wrap to two lines on narrow screens
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 12 }}>
            {showLogos ? (
              <Image
                source={require('../logos/logo_128.png')}
                style={{ width: 40, height: 40, marginRight: 12, borderRadius: 8 }}
                accessibilityLabel="PumpfoilMap logo"
              />
            ) : null}
            <Text testID="app-title" style={{ color: 'white', fontSize: 18, fontWeight: '600' }}>
              PumpfoilMap — Spots
            </Text>
          </View>
          {(!admin && !showForm && !loading) && (
            <ActionBar
              isCompact={typeof window !== 'undefined' && window.innerWidth < 600}
              onAddPonton={() => {
                setForm((f: any) => ({ ...f, type: 'ponton' }));
                setShowForm(true);
              }}
              onAddAssociation={() => {
                setForm((f: any) => ({ ...f, type: 'association' }));
                setShowForm(true);
              }}
              onAdmin={() => {
                if (!admin) {
                  setAdminPrompt(true);
                } else {
                  setAdmin(true);
                }
              }}
            />
          )}
        </View>
      </View>
      {/* Action buttons moved below the header title for better mobile layout */}
      {showGdpr && (
        <View style={{ backgroundColor: '#fffbdd', padding: 10, borderBottomWidth: 1, borderBottomColor: '#e2d69e' }}>
          <Text style={{ color: '#5d5400' }}>
            Ce site utilise des cookies/analytiques nécessaires au fonctionnement. En continuant, vous acceptez notre politique de confidentialité.
          </Text>
          <View style={{ flexDirection: 'row', marginTop: 8 }}>
            <Pressable
              onPress={() => {
                try { localStorage.setItem('pfm-consent', 'ok'); } catch {}
                setShowGdpr(false);
              }}
              style={{ backgroundColor: '#0b3d91', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 4, marginRight: 8 }}
            >
              <Text style={{ color: 'white', fontWeight: '600' }}>J'accepte</Text>
            </Pressable>
          </View>
        </View>
      )}
      {adminPrompt && !admin && (
        <View style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: '#eee', backgroundColor: '#fff' }}>
          <Text style={{ fontWeight: '600', marginBottom: 8 }}>Authentification administrateur</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TextInput
              testID="admin-password-input"
              value={adminPass}
              onChangeText={(v) => { setAdminPass(v); setAdminAuthError(null); }}
              placeholder="Mot de passe admin"
              secureTextEntry
              autoCapitalize="none"
              style={{ flex: 1, borderWidth: 1, borderColor: adminAuthError ? 'tomato' : '#bbb', borderRadius: 4, padding: 8, marginRight: 8 }}
            />
            <Pressable
              testID="admin-password-validate"
              onPress={async () => {
                setAdminAuthError(null);
                setAdminAuthLoading(true);
                try {
                  const ok = await checkAdminPassword(adminPass);
                  if (ok) {
                    setAdmin(true);
                    setAdminPrompt(false);
                    // Save md5 of the provided password for subsequent admin API calls
                    try { setAdminMd5Token(md5hash(adminPass)); } catch {}
                    setAdminPass('');
                    try { localStorage.setItem('pfm-admin-auth', 'ok'); } catch {}
                  } else {
                    setAdminAuthError('Mot de passe invalide');
                  }
                } catch {
                  setAdminAuthError('Erreur de connexion');
                } finally {
                  setAdminAuthLoading(false);
                }
              }}
              disabled={adminAuthLoading}
              style={{ backgroundColor: '#0b3d91', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6, opacity: adminAuthLoading ? 0.6 : 1 }}
            >
              <Text style={{ color: 'white', fontWeight: '600' }}>{adminAuthLoading ? 'Vérification…' : 'Valider'}</Text>
            </Pressable>
          </View>
          {!!adminAuthError && (
            <Text testID="admin-auth-error" style={{ color: 'tomato', marginTop: 6 }}>{adminAuthError}</Text>
          )}
        </View>
      )}
      {!admin && showForm ? (
        <ScrollView style={{ flex: 1, padding: 12 }} contentContainerStyle={{ paddingBottom: 60 }}>
          <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 12 }}>Soumettre un spot</Text>
          {/* Framed container for all form fields */}
          <View style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, backgroundColor: '#fff', padding: 12, marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', marginBottom: 8 }}>
              {(['ponton', 'association'] as const).map((t) => (
                <Pressable
                  key={t}
                  onPress={() => setForm((f: any) => ({ ...f, type: t }))}
                  style={{
                    paddingVertical: 6,
                    paddingHorizontal: 12,
                    backgroundColor: form.type === t ? '#0b3d91' : '#ddd',
                    marginRight: 8,
                    borderRadius: 4
                  }}
                >
                  <Text style={{ color: form.type === t ? 'white' : '#333' }}>{t}</Text>
                </Pressable>
              ))}
            </View>
            {[
              ['Nom', 'name'],
            // lat/lon now selected on map
              ['Soumis par', 'submittedBy'],
              form.type === 'ponton' && ['Hauteur (cm)', 'heightCm'],
              form.type === 'ponton' && ['Longueur (m)', 'lengthM'],
              form.type === 'ponton' && ['Adresse', 'address'],
              ['Description', 'description'],
              ['Image URL', 'imageUrl'],
              ['Email (facultatif)', 'contactEmail'],
              form.type === 'association' && ['Site (url)', 'url']
            ].filter(Boolean).map((row: any) => {
              const [label, key] = row;
              return (
                <View key={key} style={{ marginBottom: 10 }}>
                  <Text style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>{label}</Text>
                  <TextInput
                    testID={`input-${key}`}
                    value={form[key]}
                    onChangeText={(v) => setForm((f: any) => ({ ...f, [key]: v }))}
                    style={{ borderWidth: 1, borderColor: errors[key] ? 'tomato' : '#bbb', borderRadius: 4, padding: 8 }}
                    placeholder={label}
                    autoCapitalize="none"
                  />
                  {!!errors[key] && (
                    <Text testID={`error-${key}`} style={{ color: 'tomato', marginTop: 4, fontSize: 12 }}>{errors[key]}</Text>
                  )}
                </View>
              );
            })}
            {form.type === 'ponton' && (
              <View style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>Accès</Text>
                <View style={{ flexDirection: 'row' }}>
                  {(['autorise', 'tolere'] as const).map((a) => (
                    <Pressable
                      key={a}
                      onPress={() => setForm((f: any) => ({ ...f, access: a }))}
                      style={{
                        paddingVertical: 6,
                        paddingHorizontal: 12,
                        backgroundColor: form.access === a ? '#0b3d91' : '#ddd',
                        marginRight: 8,
                        borderRadius: 4
                      }}
                    >
                      <Text style={{ color: form.access === a ? 'white' : '#333' }}>{a}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
            <View style={{ marginTop: 16, padding: 8, backgroundColor: '#eef', borderRadius: 4 }}>
              <Text style={{ fontSize: 12, color: '#333' }}>
                Sélection des coordonnées: utilisez le bouton "Choisir sur la carte" puis cliquez/tapez sur la carte. Les valeurs seront remplies automatiquement.
              </Text>
              <View style={{ flexDirection: 'row', marginTop: 8 }}>
                <Pressable testID="btn-choose-on-map"
                  onPress={() => {
                    // Enable picking and show the map view
                    setForm((f: any) => ({ ...f, picking: true }));
                    setShowForm(false);
                  }}
                  style={{ backgroundColor: '#0b3d91', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6, marginRight: 12 }}
                >
                  <Text style={{ color: 'white', fontWeight: '600' }}>Choisir sur la carte</Text>
                </Pressable>
                <Text style={{ alignSelf: 'center', color: '#555' }}>
                  {form.lat && form.lng ? `Lat: ${form.lat}  Lon: ${form.lng}` : 'Aucune coordonnée choisie'}
                </Text>
              </View>
              {!!errors.latlng && (
                <Text testID="error-latlng" style={{ color: 'tomato', marginTop: 6, fontSize: 12 }}>{errors.latlng}</Text>
              )}
            </View>
            {/* Captcha section */}
            <View testID="captcha-section" style={{ marginTop: 16, padding: 8, backgroundColor: '#f7f7f7', borderRadius: 4 }}>
              <Text style={{ fontSize: 12, color: '#333', marginBottom: 8 }}>Vérification captcha</Text>
              {!captchaVerified && captchaSvgUrl ? (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {/* Render SVG via data URL */}
                  <Image testID="captcha-image" source={{ uri: captchaSvgUrl }} style={{ width: 160, height: 60, marginRight: 8, borderWidth: 1, borderColor: '#ccc', borderRadius: 4 }} />
                  <TextInput
                    testID="captcha-input"
                    value={captchaAnswer}
                    onChangeText={(v) => { setCaptchaAnswer(v); setCaptchaError(null); }}
                    placeholder="Réponse"
                    autoCapitalize="none"
                    style={{ flex: 1, borderWidth: 1, borderColor: captchaError ? 'tomato' : '#bbb', borderRadius: 4, padding: 8 }}
                  />
                </View>
              ) : captchaVerified ? (
                <Text style={{ fontSize: 12, color: '#2ecc71' }}>Captcha validé ✅</Text>
              ) : (
                <Text style={{ fontSize: 12, color: '#666' }}>Veuillez résoudre le captcha avant de soumettre.</Text>
              )}
              {!!captchaError && <Text testID="captcha-error" style={{ color: 'tomato', marginTop: 6, fontSize: 12 }}>{captchaError}</Text>}
              {!captchaVerified && (
                <View style={{ flexDirection: 'row', marginTop: 8 }}>
                  <Pressable
                  testID="btn-refresh-captcha"
                  onPress={async () => {
                    setCaptchaLoading(true);
                    setCaptchaVerified(false);
                    setCaptchaError(null);
                    setCaptchaAnswer('');
                    try {
                      const { data, secret } = await getCaptcha();
                      const url = buildSvgDataUrl(data);
                      setCaptchaSecret(secret);
                      setCaptchaSvgUrl(url);
                      if (process.env.NODE_ENV !== 'production') {
                        try { (window as any).PFM_TEST = { ...(window as any).PFM_TEST, captchaSecret: secret }; } catch {}
                      }
                    } catch {
                      setCaptchaError('Erreur de chargement du captcha');
                    } finally {
                      setCaptchaLoading(false);
                    }
                  }}
                  style={{ backgroundColor: '#ddd', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 4, marginRight: 8 }}
                >
                  <Text style={{ color: '#333', fontWeight: '600' }}>{captchaLoading ? 'Chargement…' : 'Rafraîchir le captcha'}</Text>
                  </Pressable>
                  <Pressable
                  testID="btn-validate-captcha"
                  onPress={async () => {
                    setCaptchaError(null);
                    setCaptchaLoading(true);
                    try {
                      let ok = false;
                      if (process.env.NODE_ENV !== 'production' && (window as any)?.PFM_TEST?.forceCaptchaAnswer) {
                        ok = String((window as any).PFM_TEST.forceCaptchaAnswer).toLowerCase() === String(captchaAnswer).toLowerCase().trim();
                      } else {
                        ok = await verifyCaptcha(captchaSecret!, captchaAnswer);
                      }
                      if (!ok) {
                        setCaptchaError('Captcha incorrect');
                        // Auto-refresh for next attempt
                        try {
                          const { data, secret } = await getCaptcha();
                          const url = buildSvgDataUrl(data);
                          setCaptchaSecret(secret);
                          setCaptchaSvgUrl(url);
                          setCaptchaAnswer('');
                          if (process.env.NODE_ENV !== 'production') {
                            try { (window as any).PFM_TEST = { ...(window as any).PFM_TEST, captchaSecret: secret }; } catch {}
                          }
                        } catch {}
                        return;
                      }
                      setCaptchaVerified(true);
                    } catch {
                      setCaptchaError('Erreur de vérification');
                    } finally {
                      setCaptchaLoading(false);
                    }
                  }}
                  style={{ backgroundColor: '#0b3d91', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 4 }}
                >
                    <Text style={{ color: 'white', fontWeight: '600' }}>Valider le captcha</Text>
                  </Pressable>
                </View>
              )}
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Pressable testID="btn-submit-spot"
              disabled={submitting || !captchaVerified}
              onPress={async () => {
              setSubmitMessage(null);
              const v = validateForm(form);
              setErrors(v);
              if (Object.keys(v).length) {
                return;
              }
              // Captcha must be validated before submission
              if (!captchaVerified) {
                setSubmitMessage('Veuillez valider le captcha.');
                return;
              }
              setSubmitting(true);
              // Dev-only fast path to avoid backend dependency in E2E
              if (process.env.NODE_ENV !== 'production') {
                try {
                  const pfm = (window as any)?.PFM_TEST;
                  if (pfm?.forceSubmitError) {
                    setSubmitMessage('Erreur: ' + String(pfm.forceSubmitError));
                    setSubmitting(false);
                    return;
                  }
                  if (pfm?.forceSubmitOk) {
                    // In dev/E2E, show the success modal directly; defer to next tick to avoid click interception
                    setTimeout(() => setSubmitModalOpen(true), 100);
                    setSubmitting(false);
                    return;
                  }
                } catch {}
              }
              try {
                // Build payload
                const base: any = {
                  type: form.type,
                  name: form.name,
                  lat: Number(form.lat),
                  lng: Number(form.lng),
                  submittedBy: form.submittedBy,
                  description: form.description || undefined,
                  imageUrl: form.imageUrl || undefined,
                  contactEmail: form.contactEmail || undefined
                };
                let payload: SubmitSpotInput;
                if (form.type === 'ponton') {
                  payload = {
                    ...base,
                    type: 'ponton',
                    // height entered and stored in centimeters
                    heightCm: Number(form.heightCm),
                    lengthM: Number(form.lengthM),
                    access: form.access,
                    address: form.address
                  } as any;
                } else {
                  payload = {
                    ...base,
                    type: 'association',
                    url: form.url || undefined
                  } as any;
                }
                await submitSpot(payload);
                // Show success modal instead of inline message
                setSubmitModalOpen(true);
                setForm((f: any) => ({ ...f, name: '', description: '' }));
              } catch (e: any) {
                setSubmitMessage('Erreur: ' + e.message);
              } finally {
                setSubmitting(false);
              }
              }}
              style={{
                backgroundColor: (submitting || !captchaVerified) ? '#5f78a8' : '#0b3d91',
                padding: 12,
                borderRadius: 6,
                opacity: (submitting || !captchaVerified) ? 0.6 : 1,
                marginRight: 8,
                // RN Web-only styling improves affordance
                cursor: (submitting || !captchaVerified) ? 'not-allowed' as any : 'pointer' as any
              }}
            >
              <Text style={{ textAlign: 'center', color: 'white', fontWeight: '600' }}>
                {submitting ? 'Envoi…' : 'Soumettre'}
              </Text>
            </Pressable>
            <Pressable
              testID="btn-cancel-return"
              onPress={() => setShowForm(false)}
              style={{ backgroundColor: '#ddd', paddingVertical: 12, paddingHorizontal: 14, borderRadius: 6 }}
            >
              <Text style={{ color: '#333', fontWeight: '600' }}>Retour à la carte</Text>
            </Pressable>
          </View>
          {submitMessage && !submitModalOpen && (
            <Text style={{ marginTop: 12, color: submitMessage.startsWith('✅') ? 'green' : 'tomato' }}>
              {submitMessage}
            </Text>
          )}
          {/* Bouton de retour déplacé à côté de "Soumettre" */}
        </ScrollView>
      ) : !admin && loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator />
          <Text style={{ marginTop: 8, color: '#666' }}>Chargement des spots…</Text>
        </View>
      ) : !admin ? (
        <Map
          points={points}
          picking={!!form.picking}
          onPickLocation={(c: { lat: number; lon: number }) => {
            setForm((f: any) => ({ ...f, lat: c.lat.toFixed(5), lng: c.lon.toFixed(5), picking: false }));
            // Automatically return to the form after a successful pick
            setShowForm(true);
          }}
        />
      ) : (
        <AdminPanel md5Token={adminMd5Token ?? undefined} onExit={() => setAdmin(false)} />
      )}
      
      {!!error && !showForm && (
        <View style={{ position: 'absolute', bottom: 8, left: 8, right: 8 }}>
          <Text style={{ color: 'tomato' }}>{error}</Text>
        </View>
      )}
      {/* Success modal after submission */}
      <SubmitSuccessModal
        visible={submitModalOpen}
        onOk={() => {
          setSubmitModalOpen(false);
          setShowForm(false);
        }}
      />
    </View>
  );
}

function AdminPanel({ onExit, md5Token }: { onExit?: () => void; md5Token?: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageAssoc, setPageAssoc] = useState(0);
  const [pagePonton, setPagePonton] = useState(0);
  const [filter, setFilter] = useState('');
  const [selectOnMap, setSelectOnMap] = useState(false);
  const [mapSelection, setMapSelection] = useState<any | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all'|'pending'|'approved'|'rejected'>('pending');
  const size = 20;
  const base = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3000';
  // Use md5 provided by successful admin login; do not expose ADMIN_TOKEN to the client
  const adminMd5 = md5Token || '';

  async function fetchPending() {
    try {
      // Ne pas flash l'écran: on ne touche pas à "loading" si déjà chargé
  const r = await fetch(`${base}/admin/spots?size=1000&status=${statusFilter}` , {
        headers: { authorization: `Bearer ${adminMd5}` }
      });
      const d = await r.json();
      setItems(d.items || []);
      // Reset pagination si la liste change
      setPageAssoc(0);
      setPagePonton(0);
    } catch (e: any) {
      setError(String(e));
    }
  }

  useEffect(() => {
    let mounted = true;
  fetch(`${base}/admin/spots?size=1000&status=${statusFilter}` as string, { headers: { authorization: `Bearer ${adminMd5}` } })
      .then((r) => r.json())
      .then((d) => {
        if (!mounted) return;
        setItems(d.items || []);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
    return () => { mounted = false; };
  }, [statusFilter]);

  if (loading) return <View style={{ padding: 12 }}><Text>Chargement…</Text></View>;
  if (error) return <View style={{ padding: 12 }}><Text style={{ color: 'tomato' }}>{error}</Text></View>;

  const normalized = filter.trim().toLowerCase();
  const filtered = normalized
    ? items.filter((s) =>
        [s.name, s.type, s.submittedBy, s.address]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(normalized))
      )
    : items;
  const assoc = filtered.filter((s) => s.type === 'association');
  const pontons = filtered.filter((s) => s.type === 'ponton');
  const startA = pageAssoc * size;
  const endA = startA + size;
  const startP = pagePonton * size;
  const endP = startP + size;
  const pageAssocItems = assoc.slice(startA, endA);
  const pagePontonItems = pontons.slice(startP, endP);

  return (
    <ScrollView style={{ flex: 1, padding: 12 }}>
      <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 12 }}>Administration — Spots</Text>
      <View style={{ marginBottom: 10, flexDirection: 'row', alignItems: 'center' }}>
        <TextInput
          placeholder="Filtrer (nom, type, auteur, adresse)"
          value={filter}
          onChangeText={setFilter}
          style={{ flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 6, padding: 8, marginRight: 8 }}
        />
        <Pressable testID="btn-select-on-map" onPress={() => setSelectOnMap((v) => !v)} style={{ backgroundColor: selectOnMap ? '#0b3d91' : '#ddd', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6 }}>
          <Text style={{ color: selectOnMap ? 'white' : '#333' }}>{selectOnMap ? 'Sélection carte: ON' : 'Sélection sur carte'}</Text>
        </Pressable>
      </View>
      <View style={{ marginBottom: 10, flexDirection: 'row' }}>
        {(['pending', 'approved', 'rejected', 'all'] as const).map((s) => (
          <Pressable key={s} onPress={() => setStatusFilter(s)} style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 4, backgroundColor: statusFilter===s ? '#0b3d91' : '#ddd', marginRight: 8 }}>
            <Text style={{ color: statusFilter===s ? 'white' : '#333' }}>{s}</Text>
          </Pressable>
        ))}
      </View>
      {selectOnMap && (
        <View style={{ height: 300, marginBottom: 12, borderWidth: 1, borderColor: '#ddd', borderRadius: 6, overflow: 'hidden' }}>
          <Map
            points={items.map((s:any) => ({ lat: s.lat, lon: s.lng, title: s.name, description: s.description, type: s.type }))}
            picking
            onPickLocation={({ lat, lon }) => {
              const sel = items.reduce<{s:any; d:number}|null>((acc, s:any) => {
                const d = Math.hypot((s.lat - lat), (s.lng - lon));
                if (!acc || d < acc.d) return { s, d };
                return acc;
              }, null);
              if (sel && sel.d < 0.1) {
                setMapSelection(sel.s);
                setSelectedId(sel.s.spotId);
                // Center the correct table pagination on the selected row
                if (sel.s.type === 'association') {
                  const idx = assoc.findIndex((x:any) => x.spotId === sel.s.spotId);
                  if (idx >= 0) setPageAssoc(Math.floor(idx / size));
                } else if (sel.s.type === 'ponton') {
                  const idx = pontons.findIndex((x:any) => x.spotId === sel.s.spotId);
                  if (idx >= 0) setPagePonton(Math.floor(idx / size));
                }
              }
            }}
          />
          <View style={{ position: 'absolute', top: 8, left: 8, right: 8 }}>
            <View style={{ backgroundColor: 'rgba(0,0,0,0.6)', padding: 8, borderRadius: 6 }}>
              <Text style={{ color: 'white', fontWeight: '600' }}>{mapSelection ? `Sélection: ${mapSelection.name}` : 'Cliquez sur la carte pour sélectionner un spot'}</Text>
            </View>
          </View>
        </View>
      )}
      {/* Associations table */}
      <Text style={{ fontSize: 16, fontWeight: '600', marginTop: 8, marginBottom: 6 }}>Associations</Text>
      <View style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 6 }}>
        <View style={{ flexDirection: 'row', backgroundColor: '#f4f4f4', padding: 8 }}>
          <Text style={{ width: 140, fontWeight: '600' }}>Date</Text>
          <Text style={{ width: 180, fontWeight: '600' }}>Nom</Text>
          <Text style={{ width: 200, fontWeight: '600' }}>URL</Text>
          <Text style={{ width: 120, fontWeight: '600' }}>Soumis par</Text>
          <Text style={{ width: 90, fontWeight: '600' }}>lat</Text>
          <Text style={{ width: 90, fontWeight: '600' }}>lng</Text>
          <Text style={{ flex: 1, fontWeight: '600' }}>Description</Text>
          <Text style={{ width: 240, fontWeight: '600' }}>Actions</Text>
        </View>
        {pageAssocItems.map((s) => (
          <AdminRow key={s.spotId} spot={s} adminMd5={adminMd5} onChanged={fetchPending} selected={selectedId === s.spotId} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
        <Pressable disabled={pageAssoc===0} onPress={() => setPageAssoc((p) => Math.max(0, p-1))} style={{ opacity: pageAssoc===0?0.5:1, backgroundColor: '#ddd', padding: 8, borderRadius: 4 }}>
          <Text>Précédent</Text>
        </Pressable>
        <Pressable disabled={endA>=assoc.length} onPress={() => setPageAssoc((p) => p+1)} style={{ opacity: endA>=assoc.length?0.5:1, backgroundColor: '#ddd', padding: 8, borderRadius: 4 }}>
          <Text>Suivant</Text>
        </Pressable>
      </View>

      {/* Pontons table */}
      <Text style={{ fontSize: 16, fontWeight: '600', marginTop: 14, marginBottom: 6 }}>Pontons</Text>
      <View style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 6 }}>
        <View style={{ flexDirection: 'row', backgroundColor: '#f4f4f4', padding: 8 }}>
          <Text style={{ width: 140, fontWeight: '600' }}>Date</Text>
          <Text style={{ width: 180, fontWeight: '600' }}>Nom</Text>
          <Text style={{ width: 100, fontWeight: '600' }}>Hauteur (cm)</Text>
          <Text style={{ width: 110, fontWeight: '600' }}>Longueur (m)</Text>
          <Text style={{ width: 110, fontWeight: '600' }}>Accès</Text>
          <Text style={{ width: 200, fontWeight: '600' }}>Adresse</Text>
          <Text style={{ width: 90, fontWeight: '600' }}>lat</Text>
          <Text style={{ width: 90, fontWeight: '600' }}>lng</Text>
          <Text style={{ flex: 1, fontWeight: '600' }}>Description</Text>
          <Text style={{ width: 240, fontWeight: '600' }}>Actions</Text>
        </View>
        {pagePontonItems.map((s) => (
          <AdminRow key={s.spotId} spot={s} adminMd5={adminMd5} onChanged={fetchPending} selected={selectedId === s.spotId} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
        <Pressable disabled={pagePonton===0} onPress={() => setPagePonton((p) => Math.max(0, p-1))} style={{ opacity: pagePonton===0?0.5:1, backgroundColor: '#ddd', padding: 8, borderRadius: 4 }}>
          <Text>Précédent</Text>
        </Pressable>
        <Pressable disabled={endP>=pontons.length} onPress={() => setPagePonton((p) => p+1)} style={{ opacity: endP>=pontons.length?0.5:1, backgroundColor: '#ddd', padding: 8, borderRadius: 4 }}>
          <Text>Suivant</Text>
        </Pressable>
      </View>
      {/* Bottom actions */}
      <View style={{ marginTop: 16, alignItems: 'flex-end' }}>
        <Pressable
          testID="btn-admin-return"
          onPress={() => onExit?.()}
          style={{ backgroundColor: '#ddd', paddingVertical: 12, paddingHorizontal: 14, borderRadius: 6 }}
        >
          <Text style={{ color: '#333', fontWeight: '600' }}>Retour à la carte</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
function AdminRow({ spot, onChanged, selected, adminMd5 }: { spot: any; onChanged?: () => void; selected?: boolean; adminMd5: string }) {
  const [f, setF] = useState<any>({ ...spot });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const base = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3000';

  async function save(status?: 'approved'|'rejected') {
    setSaving(true);
    try {
      const payload = { ...f };
      if (status) payload.status = status;
  const res = await fetch(`${base}/admin/spots/${spot.spotId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', authorization: `Bearer ${adminMd5}` }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error(String(res.status));
      onChanged?.();
    } finally {
      setSaving(false);
    }
  }

  const dt = new Date(spot.createdAt);
  const dateStr = `${dt.toLocaleDateString()} ${dt.toLocaleTimeString()}`;

  const Actions = (
    <>
      <Pressable disabled={saving} onPress={() => save()} style={{ backgroundColor: '#eee', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 4, marginRight: 6 }}>
        <Text>Enregistrer</Text>
      </Pressable>
      <Pressable disabled={saving} onPress={() => save('approved')} style={{ backgroundColor: '#2ecc71', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 4, marginRight: 6 }}>
        <Text style={{ color: 'white' }}>Valider</Text>
      </Pressable>
      <Pressable disabled={saving} onPress={() => save('rejected')} style={{ backgroundColor: '#e74c3c', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 4 }}>
        <Text style={{ color: 'white' }}>Refuser</Text>
      </Pressable>
      <Pressable
        disabled={deleting}
        onPress={async () => {
          const ok = typeof window !== 'undefined' && typeof window.confirm === 'function' ? window.confirm('Supprimer ce spot ?') : false;
          if (!ok) return;
          setDeleting(true);
          try {
            const res = await fetch(`${base}/admin/spots/${spot.spotId}`, { method: 'DELETE', headers: { authorization: `Bearer ${adminMd5}` } });
            if (!res.ok && res.status !== 204) throw new Error(String(res.status));
            onChanged?.();
          } catch {
            // ignore minimal UI
          } finally {
            setDeleting(false);
          }
        }}
        style={{ backgroundColor: '#c0392b', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 4, marginLeft: 6 }}
      >
        <Text style={{ color: 'white' }}>{deleting ? 'Suppression…' : 'Supprimer'}</Text>
      </Pressable>
    </>
  );

  if (f.type === 'association') {
    return (
      <View style={{ flexDirection: 'row', padding: 8, borderTopWidth: 1, borderTopColor: '#eee', alignItems: 'center', backgroundColor: selected ? '#eef7ff' : 'transparent' }}>
        <Text style={{ width: 140 }}>{dateStr}</Text>
        <TextInput value={f.name} onChangeText={(v) => setF((x:any)=>({ ...x, name:v }))} style={{ width: 180, borderWidth:1,borderColor:'#ddd', borderRadius:4, padding:4, marginRight: 6 }} />
        <TextInput placeholder="URL" value={f.url || ''} onChangeText={(v) => setF((x:any)=>({ ...x, url:v }))} style={{ width: 200, borderWidth:1,borderColor:'#ddd', borderRadius:4, padding:4, marginRight: 6 }} />
        <TextInput value={f.submittedBy || ''} onChangeText={(v) => setF((x:any)=>({ ...x, submittedBy:v }))} style={{ width: 120, borderWidth:1,borderColor:'#ddd', borderRadius:4, padding:4, marginRight: 6 }} />
        <TextInput placeholder="lat" value={String(f.lat ?? '')} onChangeText={(v)=> setF((x:any)=>({ ...x, lat: v }))} style={{ width: 90, borderWidth:1, borderColor:'#ddd', borderRadius:4, padding:4, marginRight: 6 }} />
        <TextInput placeholder="lng" value={String(f.lng ?? '')} onChangeText={(v)=> setF((x:any)=>({ ...x, lng: v }))} style={{ width: 90, borderWidth:1, borderColor:'#ddd', borderRadius:4, padding:4, marginRight: 6 }} />
        <TextInput placeholder="Description" value={f.description||''} onChangeText={(v)=> setF((x:any)=>({ ...x, description:v }))} style={{ flex:1, borderWidth:1, borderColor:'#ddd', borderRadius:4, padding:4, marginRight: 8 }} />
        <View style={{ width: 240, flexDirection: 'row', flexWrap: 'wrap' }}>{Actions}</View>
      </View>
    );
  }

  // Ponton default
  return (
    <View style={{ flexDirection: 'row', padding: 8, borderTopWidth: 1, borderTopColor: '#eee', alignItems: 'center', backgroundColor: selected ? '#eef7ff' : 'transparent' }}>
      <Text style={{ width: 140 }}>{dateStr}</Text>
      <TextInput value={f.name} onChangeText={(v) => setF((x:any)=>({ ...x, name:v }))} style={{ width: 180, borderWidth:1,borderColor:'#ddd', borderRadius:4, padding:4, marginRight: 6 }} />
      <TextInput placeholder="Hauteur (cm)" value={String(f.heightCm ?? '')} onChangeText={(v) => setF((x:any)=>({ ...x, heightCm:v }))} style={{ width: 100, borderWidth:1,borderColor:'#ddd', borderRadius:4, padding:4, marginRight: 6 }} />
      <TextInput placeholder="Longueur (m)" value={String(f.lengthM ?? '')} onChangeText={(v) => setF((x:any)=>({ ...x, lengthM:v }))} style={{ width: 110, borderWidth:1,borderColor:'#ddd', borderRadius:4, padding:4, marginRight: 6 }} />
      <TextInput placeholder="Accès" value={f.access || ''} onChangeText={(v) => setF((x:any)=>({ ...x, access:v }))} style={{ width: 110, borderWidth:1,borderColor:'#ddd', borderRadius:4, padding:4, marginRight: 6 }} />
      <TextInput placeholder="Adresse" value={f.address || ''} onChangeText={(v) => setF((x:any)=>({ ...x, address:v }))} style={{ width: 200, borderWidth:1,borderColor:'#ddd', borderRadius:4, padding:4, marginRight: 6 }} />
      <TextInput placeholder="lat" value={String(f.lat ?? '')} onChangeText={(v)=> setF((x:any)=>({ ...x, lat: v }))} style={{ width: 90, borderWidth:1, borderColor:'#ddd', borderRadius:4, padding:4, marginRight: 6 }} />
      <TextInput placeholder="lng" value={String(f.lng ?? '')} onChangeText={(v)=> setF((x:any)=>({ ...x, lng: v }))} style={{ width: 90, borderWidth:1, borderColor:'#ddd', borderRadius:4, padding:4, marginRight: 6 }} />
      <TextInput placeholder="Description" value={f.description||''} onChangeText={(v)=> setF((x:any)=>({ ...x, description:v }))} style={{ flex:1, borderWidth:1, borderColor:'#ddd', borderRadius:4, padding:4, marginRight: 8 }} />
      <View style={{ width: 240, flexDirection: 'row', flexWrap: 'wrap' }}>{Actions}</View>
    </View>
  );
}
