import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSesion } from '../sesion.jsx';
import { useTema } from '../tema.js';
import { AvisoDespertando, Boton, Campo, Error, Tarjeta, Texto, useAccion } from '../components/ui.jsx';

export default function Login() {
  const t = useTema();
  const { login, register } = useSesion();
  const [esLogin, setEsLogin] = useState(true);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const { cargando, error, setError, correr } = useAccion();

  const cambiar = (campo) => (v) => setForm({ ...form, [campo]: v });
  const enviar = () => correr(() =>
    esLogin ? login({ email: form.email, password: form.password }) : register(form));

  return (
    <SafeAreaView style={[s.flex, { backgroundColor: t.fondo }]}>
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.contenido} keyboardShouldPersistTaps="handled">
          <Texto negrita style={s.logo}>🎓 UniPlanner</Texto>
          <Texto suave style={s.centrado}>
            {esLogin ? 'Inicia sesión para ver tus ramos' : 'Crea tu cuenta'}
          </Texto>

          <Tarjeta>
            {!esLogin && (
              <Campo etiqueta="Nombre" value={form.name} onChangeText={cambiar('name')}
                autoComplete="name" textContentType="name" />
            )}
            <Campo etiqueta="Email" value={form.email} onChangeText={cambiar('email')}
              autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" />
            <Campo etiqueta="Contraseña" value={form.password} onChangeText={cambiar('password')}
              secureTextEntry autoComplete={esLogin ? 'current-password' : 'new-password'}
              placeholder={esLogin ? undefined : 'Mínimo 8 caracteres'} onSubmitEditing={enviar} />

            <Error>{error}</Error>
            <AvisoDespertando esperando={cargando} />
            <Boton titulo={esLogin ? 'Entrar' : 'Registrarme'} onPress={enviar} cargando={cargando} />
          </Tarjeta>

          <Pressable accessibilityRole="button" onPress={() => { setEsLogin(!esLogin); setError(''); }}>
            <Texto style={[s.centrado, { color: t.primario }]}>
              {esLogin ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
            </Texto>
          </Pressable>
          <Texto chico suave style={s.centrado}>
            Es la misma cuenta de la web: tus ramos aparecen en los dos lados.
          </Texto>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  contenido: { padding: 20, gap: 16, justifyContent: 'center', flexGrow: 1, maxWidth: 480, width: '100%', alignSelf: 'center' },
  logo: { fontSize: 30, textAlign: 'center' },
  centrado: { textAlign: 'center' },
});
