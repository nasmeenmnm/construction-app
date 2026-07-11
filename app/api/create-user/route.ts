import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, name, role, parent_id } = body;

    // Create a Supabase admin client using the SERVICE ROLE key
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // 1. Create the user in the secure Auth vault
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true, // Auto-confirm the email so they can log in immediately
      user_metadata: { name: name }
    });

    if (authError) throw authError;

    // 2. Update their role and parent_id in our public profiles table
    // 2. Insert or Update their profile in the public table
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({ 
        id: authData.user.id,       // Explicitly link the ID
        name: name,
        role: role,
        parent_id: parent_id 
      });

    if (profileError) throw profileError;

    return NextResponse.json({ success: true, user: authData.user });

  } catch (error: any) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}