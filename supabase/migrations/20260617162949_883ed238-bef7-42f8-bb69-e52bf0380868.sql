
CREATE POLICY "Autenticados gerenciam notas fornecedores"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'notas-fornecedores')
WITH CHECK (bucket_id = 'notas-fornecedores');
