const SAVE_PASSWORD = '1'

export function confirmPassword(): boolean {
  const input = window.prompt('Digite a senha para salvar/alterar:')
  if (input === null) return false
  if (input !== SAVE_PASSWORD) {
    alert('Senha incorreta.')
    return false
  }
  return true
}
