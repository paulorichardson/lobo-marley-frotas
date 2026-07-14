UPDATE auth.users
SET encrypted_password = crypt('tremedal01', gen_salt('bf')),
    updated_at = now()
WHERE id = '85c4c4a5-0e83-4949-a46f-b35c446e122a';