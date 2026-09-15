# Configurar el administrador

El administrador usa correo y una contraseña de mínimo 8 caracteres. Los vendedores usan el mismo campo de correo, pero ingresan el PIN de 4 a 8 dígitos que el admin les asigna desde `Vendedores`.

Desde PowerShell, ubicado en la carpeta `backend`, ejecuta:

```powershell
python -m scripts.create_admin --email admin@coffeegosen.com --name "Administrador Coffee Gosen"
```

El comando pedirá la contraseña dos veces sin mostrarla en pantalla. Si el correo ya existe, convierte esa cuenta en admin, actualiza su nombre y cambia su contraseña. Luego el admin puede entrar en `/login` con ese correo y contraseña, abrir `Vendedores` y crear accesos de vendedores con correo y PIN.

No uses el PIN del vendedor como contraseña del administrador. El admin debe tener una contraseña distinta y de mínimo 8 caracteres.